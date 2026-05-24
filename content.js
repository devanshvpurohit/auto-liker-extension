// AuraLike Pro - Content Script
// This script runs directly in the webpage context.

// Keep internal state inside the content script so it persists even when popup is closed
let state = {
  status: 'idle', // 'idle' | 'running' | 'stopped' | 'completed'
  likesCount: 0,
  scrollsCount: 0,
  logs: [],
  config: null
};

// Maximum safety limit
const ABSOLUTE_MAX_LIKES = 700;
let loopTimer = null;
let consecutiveScrollCountWithoutLikes = 0;
const MAX_CONSECUTIVE_SCROLLS = 15; // Safeguard if page stops loading or gets rate-limited

// Helper function to check if a button is already liked (replicated inside content.js)
const checkAlreadyLiked = (element, platform) => {
  if (!element) return false;
  
  // Generic check: Look for "Unlike" or "Liked" text in the element or its parent
  const checkText = (el) => {
    const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
    return text.includes('unlike') || text.includes('liked') || text.includes('♥');
  };

  switch (platform) {
    case 'fanime':
      // 1. Check inner image source (for main grid/feed posts)
      const fanimeImg = element.querySelector('img');
      if (fanimeImg && fanimeImg.src && (fanimeImg.src.includes('F472B6') || fanimeImg.src.includes('%23F472B6'))) {
        return true;
      }
      // 2. Check inner SVG fill (for comments/other icons)
      const fanimeSvg = element.querySelector('svg');
      if (fanimeSvg) {
        const fill = fanimeSvg.getAttribute('fill');
        const path = fanimeSvg.querySelector('path');
        const pathFill = path ? path.getAttribute('fill') : null;
        if ((fill && fill !== 'none' && fill !== 'currentColor') || 
            (pathFill && pathFill !== 'none' && pathFill !== 'currentColor')) {
          return true;
        }
      }
      // 3. Check class list (Active/active/undefined)
      if (element.className.includes('Active') || element.className.includes('active') || element.className.includes('undefined')) {
        return true;
      }
      // 4. Check text content
      return checkText(element);

    case 'linkedin':
      const isLinkedInActive = element.classList.contains('react-button__trigger--active') || 
                               element.getAttribute('aria-pressed') === 'true' ||
                               element.querySelector('.react-button__trigger--active') !== null;
      if (isLinkedInActive) return true;
      // Fallback: check text in the button
      return checkText(element);

    case 'instagram':
      const instaParentBtn = element.closest('button');
      if (instaParentBtn) {
        if (instaParentBtn.querySelector('svg[aria-label="Unlike"]') || instaParentBtn.getAttribute('aria-label') === 'Unlike') return true;
      }
      return element.getAttribute('aria-label') === 'Unlike' || element.querySelector('svg[aria-label="Unlike"]') !== null;

    case 'twitter':
      const tweetArticle = element.closest('article');
      if (tweetArticle && (tweetArticle.querySelector('div[data-testid="unlike"]') || tweetArticle.querySelector('button[aria-label*="Liked"]'))) return true;
      return element.getAttribute('data-testid') === 'unlike' || (element.getAttribute('aria-label') || '').includes('Liked');

    default:
      // Custom/Default: Deep check of attributes and text
      const ariaPressed = element.getAttribute('aria-pressed');
      if (ariaPressed === 'true') return true;
      
      if (checkText(element)) return true;
      
      // Check parent button if it exists
      const parentBtn = element.closest('button');
      if (parentBtn && checkText(parentBtn)) return true;

      return false;
  }
};

// Helper: Add log to internal state and notify popup if open
function addLog(type, text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const logItem = { type, text, time };
  
  state.logs.push(logItem);
  if (state.logs.length > 60) {
    state.logs.shift(); // Keep logs buffer light
  }

  // Save to storage in case popup needs to pull it
  chrome.storage.local.set({ contentScriptState: state });

  // Broadcast log to popup (runs safely, will do nothing if popup is closed)
  try {
    chrome.runtime.sendMessage({
      type: 'log',
      data: { logType: type, text: text, time: time }
    });
  } catch (err) {
    // Popup is closed, this is normal
  }
}

// Broadcast progress update to popup
function broadcastProgress() {
  chrome.storage.local.set({ contentScriptState: state });
  try {
    chrome.runtime.sendMessage({
      type: 'progress_update',
      data: {
        likesCount: state.likesCount,
        scrollsCount: state.scrollsCount,
        limit: state.config ? state.config.limit : 250
      }
    });
  } catch (err) {
    // Popup is closed
  }
}

// Broadcast status changes
function broadcastStatus() {
  chrome.storage.local.set({ contentScriptState: state });
  try {
    chrome.runtime.sendMessage({
      type: 'status_change',
      data: { status: state.status }
    });
  } catch (err) {
    // Popup is closed
  }
}

// Restore state from local storage on script load
chrome.storage.local.get(['contentScriptState'], (result) => {
  if (result.contentScriptState) {
    // Restore counts and configuration (only if previous run was not completely reset)
    const saved = result.contentScriptState;
    if (saved.status === 'running') {
      // If it was running when popup closed, continue running in background
      state = saved;
      addLog('system', 'Reconnecting to ongoing background automation session.');
      executeLikingLoop();
    } else {
      state = saved;
    }
  }
});

// Listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'query_status':
      sendResponse(state);
      break;

    case 'start':
      if (state.status === 'running') {
        sendResponse({ status: 'already_running' });
        return;
      }
      
      state.status = 'running';
      state.config = message.config;
      
      // Reset scroll timeout safety
      consecutiveScrollCountWithoutLikes = 0;
      
      addLog('system', `Automation deployment activated for ${message.config.platform.toUpperCase()}`);
      executeLikingLoop();
      
      broadcastStatus();
      sendResponse({ status: 'started' });
      break;

    case 'stop':
      if (state.status === 'running') {
        state.status = 'stopped';
        if (loopTimer) clearTimeout(loopTimer);
        addLog('system', 'Execution loop halted by operator request.');
        broadcastStatus();
      }
      sendResponse({ status: 'stopped' });
      break;

    case 'reset':
      state.status = 'idle';
      state.likesCount = 0;
      state.scrollsCount = 0;
      state.logs = [];
      if (loopTimer) clearTimeout(loopTimer);
      
      // Clear markers to allow re-liking if user resets
      document.querySelectorAll('[data-aura-processed]').forEach(el => el.removeAttribute('data-aura-processed'));

      addLog('system', 'Session variables reset. Ready for new cycle.');
      broadcastStatus();
      broadcastProgress();
      sendResponse({ status: 'reset' });
      break;
  }
  return true; // Keep message channel open for async operations
});

// A helper for sleep/delay
const delay = ms => new Promise(res => setTimeout(res, ms));

async function handleAutoComment(targetButton) {
  addLog('info', 'Attempting to auto-comment...');
  
  // Try to find the closest tile/post container to scope our search
  const container = targetButton.closest('article, [role="article"], div[class*="tile"], div[class*="post"], div[class*="card"]') || document.body;
  
  // Find the Comment button
  const commentBtn = container.querySelector('button[aria-label="Comment"], button[aria-label*="Comment"]');
  if (!commentBtn) {
    addLog('error', 'Comment button not found. Skipping auto-comment.');
    return;
  }
  
  commentBtn.click();
  addLog('info', 'Opened comment input.');
  
  // Helper to find the actual comment input
  const findCommentInput = () => {
    let inputs = Array.from(container.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]'));
    if (inputs.length === 0) {
      inputs = Array.from(document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]'));
    }
    // Search from end (most recently added elements, like modals or expanded sections)
    return inputs.reverse().find(el => {
      const ph = (el.getAttribute('placeholder') || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      return !ph.includes('search') && !aria.includes('search');
    });
  };

  // Wait for the textarea to appear
  await delay(1000);
  let textarea = findCommentInput();
  let retries = 6; // Try for 3 seconds
  while (!textarea && retries > 0) {
    await delay(500);
    textarea = findCommentInput();
    retries--;
  }
  
  if (!textarea) {
    addLog('error', 'Comment textarea not found. Aborting comment.');
    // Try to dismiss any modal by pressing Escape
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }
  
  // Generate random comment
  const templates = (state.config.commentTemplates && state.config.commentTemplates.length > 0) ? state.config.commentTemplates : ['Great project!'];
  const randomComment = templates[Math.floor(Math.random() * templates.length)];
  
  // Inject the comment safely
  textarea.focus();
  
  let inserted = false;
  try {
    // Method 1: execCommand simulates real user typing and triggers React's internal state accurately
    inserted = document.execCommand('insertText', false, randomComment);
  } catch(e) {}

  if (!inserted && (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT')) {
    // Method 2: Native React setter bypass
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set || 
                                     Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, randomComment);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        textarea.value = randomComment;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch(e) {}
  } else if (!inserted && textarea.isContentEditable) {
    textarea.textContent = randomComment;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  addLog('info', `Pasted comment: "${randomComment}"`);
  await delay(800); // Give React time to update state
  
  // Find Post button and click
  const form = textarea.closest('form');
  let submitBtn = null;
  if (form) {
    submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  }
  
  if (!submitBtn) {
    // Look for a button containing words like "Post", "Reply", "Send" or icons for send inside the container or body
    const searchRoot = (textarea.closest('div[role="dialog"]') || container || document.body);
    const buttons = Array.from(searchRoot.querySelectorAll('button'));
    submitBtn = buttons.reverse().find(b => {
      const text = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
      const hasSendIcon = b.querySelector('svg[aria-label*="send" i], svg[aria-label*="post" i]');
      return text === 'post' || text === 'submit' || text === 'reply' || text === 'comment' || text === 'send' || hasSendIcon;
    });
  }
  
  if (submitBtn) {
    submitBtn.click();
    addLog('success', 'Comment posted via button click.');
  } else {
    // Fallback: press Enter on the textarea
    const createKey = (type) => new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
    textarea.dispatchEvent(createKey('keydown'));
    textarea.dispatchEvent(createKey('keypress'));
    textarea.dispatchEvent(createKey('keyup'));
    
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
    addLog('info', 'Pressed Enter to post comment.');
  }
  
  // Wait a bit to ensure it gets posted
  await delay(1500);
  
  // Try to close modal if it's still open (if it was a modal)
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const closeBtn = document.querySelector('button[aria-label="Close"], button[aria-label*="close" i]');
  if (closeBtn) closeBtn.click();
}

// The Main Liking Automation Loop
async function executeLikingLoop() {
  if (state.status !== 'running') return;

  // 1. Safety verification
  const currentLimit = Math.min(state.config.limit, ABSOLUTE_MAX_LIKES);
  if (state.likesCount >= currentLimit) {
    state.status = 'completed';
    addLog('success', `Limit reached: Successfully liked ${state.likesCount} posts.`);
    broadcastStatus();
    triggerEndNotification();
    return;
  }

  // 2. Discover target buttons on the entire page
  let buttons = Array.from(document.querySelectorAll(state.config.selector));
  
  // 3. Filter buttons to find the next actionable unliked one
  let unlikedButtons = [];
  let skippedAlreadyLiked = 0;
  
  for (const btn of buttons) {
    // If already processed in this session, skip
    if (btn.hasAttribute('data-aura-processed')) continue;
    
    // If it's already liked on the platform, mark as processed and skip
    if (checkAlreadyLiked(btn, state.config.platform)) {
      btn.setAttribute('data-aura-processed', 'true');
      skippedAlreadyLiked++;
      continue;
    }

    // Quick layout validation: element must have size
    const rect = btn.getBoundingClientRect();
    const hasSize = rect.width > 0 && rect.height > 0;
    
    // Note: We no longer restrict to "forward" only so it can find the first unliked post anywhere in the system
    if (hasSize) {
      unlikedButtons.push(btn);
    }
  }

  if (skippedAlreadyLiked > 0) {
    addLog('info', `Automatically skipped ${skippedAlreadyLiked} already-liked posts.`);
  }

  if (unlikedButtons.length > 0) {
    // Reset consecutive scroll safeguard since we found actionable elements
    consecutiveScrollCountWithoutLikes = 0;
    
    // Choose the first available unliked button (the "next" one in document order)
    let targetButton = unlikedButtons[0];
    
    // If the selector is targeting an SVG or other sub-element, try to find the actual button parent
    // but keep the original for highlight/marking if necessary
    const clickableElement = (targetButton.tagName !== 'BUTTON' && targetButton.closest('button')) || targetButton;

    // Highlight the target element briefly so the user can visually track what is happening
    const originalOutline = targetButton.style.outline;
    targetButton.style.outline = '3px solid #ff007f';
    targetButton.style.outlineOffset = '2px';
    targetButton.style.transition = 'outline 0.2s ease';
    
    // Smoothly scroll target into view if needed
    targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Generates a human-like interactive delay before clicking
    const clickPreDelay = Math.random() * 400 + 400; // 400ms - 800ms delay
    
    loopTimer = setTimeout(() => {
      // Remove temporary outline highlight
      targetButton.style.outline = originalOutline;
      
      try {
        // Double check state right before clicking to prevent unliking
        if (checkAlreadyLiked(targetButton, state.config.platform) || 
            (clickableElement !== targetButton && checkAlreadyLiked(clickableElement, state.config.platform))) {
          addLog('info', 'Post was liked externally or state updated. Skipping to avoid unlike.');
          targetButton.setAttribute('data-aura-processed', 'true');
          if (clickableElement !== targetButton) clickableElement.setAttribute('data-aura-processed', 'true');
          loopTimer = setTimeout(executeLikingLoop, 500);
          return;
        }

        // Mark as processed BEFORE clicking to ensure we don't pick it again even if loop triggers fast
        targetButton.setAttribute('data-aura-processed', 'true');
        if (clickableElement !== targetButton) {
          clickableElement.setAttribute('data-aura-processed', 'true');
        }

        // Trigger click event
        clickableElement.click();
        
        state.likesCount++;
        addLog('success', `Liked post #${state.likesCount} on the feed.`);
        broadcastProgress();
        
        // Auto-comment integration
        if (state.config.autoComment) {
          // Wrap in a try-catch so it doesn't break the loop on error
          try {
            await handleAutoComment(targetButton);
          } catch(e) {
            addLog('error', `Error in auto-comment: ${e.message}`);
          }
        }
        
        // Calculate random delay range based on parameters
        const minVal = state.config.minDelay * 1000;
        const maxVal = state.config.maxDelay * 1000;
        const sleepDuration = Math.random() * (maxVal - minVal) + minVal;
        
        addLog('wait', `Cooling down for ${(sleepDuration / 1000).toFixed(1)}s before next action...`);
        
        loopTimer = setTimeout(executeLikingLoop, sleepDuration);
      } catch (err) {
        addLog('error', `Failed to interact with element: ${err.message}`);
        loopTimer = setTimeout(executeLikingLoop, 2000);
      }
    }, clickPreDelay);

  } else {
    // No unliked buttons found in current view.
    if (state.config.autoScroll) {
      consecutiveScrollCountWithoutLikes++;
      
      // Safeguard check
      if (consecutiveScrollCountWithoutLikes >= MAX_CONSECUTIVE_SCROLLS) {
        state.status = 'completed';
        addLog('error', `Reached feed boundary or possible rate limit after ${MAX_CONSECUTIVE_SCROLLS} scrolls without liking. Shutting down to protect account.`);
        broadcastStatus();
        triggerEndNotification(true);
        return;
      }

      state.scrollsCount++;
      addLog('info', `No actionable elements in view. Scrolling page down (Attempt #${consecutiveScrollCountWithoutLikes})...`);
      broadcastProgress();

      // Smooth scroll viewport down
      const scrollHeight = 850;
      window.scrollBy({
        top: scrollHeight,
        behavior: 'smooth'
      });

      // Wait 2.2s for content to dynamically render/load before checking again
      loopTimer = setTimeout(executeLikingLoop, 2200);
    } else {
      // Auto scroll disabled, notify and wait
      addLog('wait', 'No unliked posts visible. Waiting for manual scrolling activity...');
      loopTimer = setTimeout(executeLikingLoop, 3000);
    }
  }
}

// Trigger browser native system notification via background service worker
function triggerEndNotification(aborted = false) {
  let title = "AuraLike Pro Automation Complete";
  let message = `Goal achieved! Successfully auto-liked ${state.likesCount} posts.`;
  
  if (aborted) {
    title = "AuraLike Pro - Safe Pause";
    message = `Process halted safely at ${state.likesCount} likes due to empty feed or rate limit warnings.`;
  }

  try {
    chrome.runtime.sendMessage({
      action: "show_notification",
      title: title,
      message: message
    });
  } catch (err) {
    // Extension runtime context might be invalidated if updated/uninstalled
  }
}
