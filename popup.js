// AuraLike Pro - Popup Script

// Platform presets selectors and state-check helpers
const PLATFORM_PRESETS = {
  fanime: {
    selector: 'button[aria-label="Like"]',
    checkLiked: (el) => {
      // 1. Check inner image source (for main grid/feed posts)
      const img = el.querySelector('img');
      if (img && img.src && (img.src.includes('F472B6') || img.src.includes('%23F472B6'))) {
        return true;
      }
      // 2. Check inner SVG fill (for comments/other icons)
      const svg = el.querySelector('svg');
      if (svg) {
        const fill = svg.getAttribute('fill');
        const path = svg.querySelector('path');
        const pathFill = path ? path.getAttribute('fill') : null;
        if ((fill && fill !== 'none' && fill !== 'currentColor') || 
            (pathFill && pathFill !== 'none' && pathFill !== 'currentColor')) {
          return true;
        }
      }
      // 3. Check class list (Active/active/undefined)
      if (el.className.includes('Active') || el.className.includes('active') || el.className.includes('undefined')) {
        return true;
      }
      // 4. Check text content
      const text = el.innerText || '';
      return text.includes('♥') || text.includes('Liked');
    }
  },
  linkedin: {
    selector: 'button.react-button__trigger',
    // Check if already liked: LinkedIn active class is "react-button__trigger--active" or if "aria-pressed" is true
    checkLiked: (el) => {
      return el.classList.contains('react-button__trigger--active') || 
             el.getAttribute('aria-pressed') === 'true' || 
             el.querySelector('.react-button__trigger--active') !== null;
    }
  },
  instagram: {
    // Selects the heart SVG that represents 'Like' (avoiding red hearts which are 'Unlike')
    selector: 'article span svg[aria-label="Like"]',
    checkLiked: (el) => {
      // If we find an 'Unlike' aria-label, it means it's already liked
      const parent = el.closest('button');
      if (parent && parent.querySelector('svg[aria-label="Unlike"]')) return true;
      return el.getAttribute('aria-label') === 'Unlike';
    }
  },
  twitter: {
    // X / Twitter like button is a div with data-testid="like"
    selector: 'article div[data-testid="like"]',
    checkLiked: (el) => {
      // If the data-testid is "unlike", it is already liked
      const article = el.closest('article');
      if (article && article.querySelector('div[data-testid="unlike"]')) return true;
      return el.getAttribute('data-testid') === 'unlike';
    }
  },
  custom: {
    selector: '',
    checkLiked: () => false // Custom mode relies on user selector targeting only unliked elements
  }
};

// UI Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const presetButtons = document.querySelectorAll('.preset-btn');
const selectorWrapper = document.getElementById('selector-wrapper');
const customSelectorInput = document.getElementById('custom-selector');
const likesLimitInput = document.getElementById('likes-limit');
const likesLimitVal = document.getElementById('likes-limit-val');
const minDelayInput = document.getElementById('min-delay');
const maxDelayInput = document.getElementById('max-delay');
const autoScrollCheckbox = document.getElementById('auto-scroll');

// Stats Elements
const statLiked = document.getElementById('stat-liked');
const statRemaining = document.getElementById('stat-remaining');
const statScrolls = document.getElementById('stat-scrolls');
const progressBar = document.getElementById('progress-bar');
const progressPercent = document.getElementById('progress-percent');

// Action Buttons
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnRestart = document.getElementById('btn-restart');
const btnClearLogs = document.getElementById('btn-clear-logs');
const consoleLogs = document.getElementById('console-logs');

let activePlatform = 'fanime';
let currentTabId = null;

// Initialize Popup
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Get the current active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) {
    logToConsole('system', 'No active tab found.');
    disableAllControls();
    return;
  }
  
  const activeTab = tabs[0];
  currentTabId = activeTab.id;

  // Validate URL (Avoid chrome:// or other restricted pages)
  if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:')) {
    logToConsole('system', 'Restricted tab. Navigate to a public website (e.g. LinkedIn, Instagram) to start.');
    disableAllControls();
    return;
  }

  // 2. Load settings from storage
  loadSettings();

  // 3. Connect/Check status of content script
  checkContentScriptStatus();

  // 4. Setup Event Listeners
  setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
  // Preset selector buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      activePlatform = btn.dataset.platform;
      
      if (activePlatform === 'custom') {
        selectorWrapper.style.display = 'flex';
      } else {
        selectorWrapper.style.display = 'none';
        customSelectorInput.value = PLATFORM_PRESETS[activePlatform].selector;
      }
      
      logToConsole('system', `Switched platform to: ${btn.innerText.trim()}`);
      saveSettings();
    });
  });

  // Selector input manual changes
  customSelectorInput.addEventListener('input', () => {
    saveSettings();
  });

  // Slider change
  likesLimitInput.addEventListener('input', (e) => {
    const val = e.target.value;
    likesLimitVal.innerText = val;
    const currentLiked = parseInt(statLiked.innerText) || 0;
    statRemaining.innerText = Math.max(0, val - currentLiked);
    updateProgressUI(currentLiked, val);
    saveSettings();
  });

  // Numeric inputs
  minDelayInput.addEventListener('change', validateDelays);
  maxDelayInput.addEventListener('change', validateDelays);
  autoScrollCheckbox.addEventListener('change', saveSettings);

  // Buttons actions
  btnStart.addEventListener('click', startLikingProcess);
  btnStop.addEventListener('click', stopLikingProcess);
  btnRestart.addEventListener('click', resetLikingProcess);
  btnClearLogs.addEventListener('click', () => {
    consoleLogs.innerHTML = '<div class="log-line system">[system] Logs cleared.</div>';
  });

  // Listen for progress/status messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab && sender.tab.id === currentTabId) {
      handleRuntimeMessage(message);
    }
  });
}

// Check if content script is already injected, and query its status
function checkContentScriptStatus() {
  chrome.tabs.sendMessage(currentTabId, { action: "query_status" }, (response) => {
    if (chrome.runtime.lastError) {
      // Content script is not injected yet (e.g. extension loaded after page loaded)
      logToConsole('system', 'Initializing secure injection into current page...');
      injectContentScript();
    } else if (response) {
      // Content script replied, handle its current state
      syncWithContentScript(response);
    }
  });
}

// Dynamically inject content script
function injectContentScript() {
  chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      logToConsole('error', 'Injection failed: ' + chrome.runtime.lastError.message);
      return;
    }
    
    // Now that it's injected, double-check its status
    setTimeout(() => {
      chrome.tabs.sendMessage(currentTabId, { action: "query_status" }, (response) => {
        if (response) {
          syncWithContentScript(response);
          logToConsole('success', 'Security handshake complete. Ready.');
        } else {
          logToConsole('error', 'Handshake failed. Refresh the tab and try again.');
        }
      });
    }, 200);
  });
}

// Sync UI with content script state response
function syncWithContentScript(state) {
  updateStatusUI(state.status);
  
  statLiked.innerText = state.likesCount;
  statScrolls.innerText = state.scrollsCount;
  
  const limit = state.config ? state.config.limit : parseInt(likesLimitInput.value);
  likesLimitVal.innerText = limit;
  likesLimitInput.value = limit;
  
  statRemaining.innerText = Math.max(0, limit - state.likesCount);
  updateProgressUI(state.likesCount, limit);

  // Sync state config inputs if it was already running
  if (state.config) {
    minDelayInput.value = state.config.minDelay;
    maxDelayInput.value = state.config.maxDelay;
    autoScrollCheckbox.checked = state.config.autoScroll;
    
    // Select platform
    const matchedPlatform = Object.keys(PLATFORM_PRESETS).find(key => 
      PLATFORM_PRESETS[key].selector === state.config.selector
    ) || 'custom';
    
    presetButtons.forEach(btn => {
      if (btn.dataset.platform === matchedPlatform) {
        btn.click();
      }
    });

    if (matchedPlatform === 'custom') {
      customSelectorInput.value = state.config.selector;
    }
  }

  // Load and render logs if they exist
  if (state.logs && state.logs.length > 0) {
    consoleLogs.innerHTML = '';
    state.logs.forEach(log => {
      logToConsole(log.type, log.text, log.time);
    });
  }

  if (state.status === 'running') {
    toggleControlsRunning(true);
  } else {
    toggleControlsRunning(false);
  }
}

// Start auto liking
function startLikingProcess() {
  const limit = parseInt(likesLimitInput.value);
  const minDelay = parseFloat(minDelayInput.value);
  const maxDelay = parseFloat(maxDelayInput.value);
  const autoScroll = autoScrollCheckbox.checked;
  
  let selector = customSelectorInput.value.trim();
  if (activePlatform !== 'custom') {
    selector = PLATFORM_PRESETS[activePlatform].selector;
  }

  if (!selector) {
    logToConsole('error', 'Please enter a valid CSS selector.');
    return;
  }

  const config = {
    platform: activePlatform,
    selector: selector,
    limit: limit,
    minDelay: minDelay,
    maxDelay: maxDelay,
    autoScroll: autoScroll
  };

  logToConsole('info', `Deploying process: Limit ${limit} likes | Delay ${minDelay}-${maxDelay}s`);
  
  chrome.tabs.sendMessage(currentTabId, { action: "start", config: config }, (response) => {
    if (chrome.runtime.lastError) {
      logToConsole('error', 'Failed to communicate with page: ' + chrome.runtime.lastError.message);
    } else if (response && response.status === 'started') {
      updateStatusUI('running');
      toggleControlsRunning(true);
    }
  });
}

// Stop auto liking
function stopLikingProcess() {
  logToConsole('wait', 'Halting script execution. Cleaning up timers...');
  
  chrome.tabs.sendMessage(currentTabId, { action: "stop" }, (response) => {
    if (response && response.status === 'stopped') {
      updateStatusUI('stopped');
      toggleControlsRunning(false);
      logToConsole('system', 'Liker stopped successfully.');
    }
  });
}

// Reset counts and configs
function resetLikingProcess() {
  logToConsole('system', 'Resetting progress counters...');
  
  chrome.tabs.sendMessage(currentTabId, { action: "reset" }, (response) => {
    if (response) {
      statLiked.innerText = '0';
      statScrolls.innerText = '0';
      const limit = parseInt(likesLimitInput.value);
      statRemaining.innerText = limit;
      updateProgressUI(0, limit);
      updateStatusUI('idle');
      toggleControlsRunning(false);
      logToConsole('success', 'Reset complete. Ready to deploy.');
    }
  });
}

// Listen to messages from content script while popup is open
function handleRuntimeMessage(message) {
  switch (message.type) {
    case 'progress_update':
      statLiked.innerText = message.data.likesCount;
      statScrolls.innerText = message.data.scrollsCount;
      const limit = message.data.limit;
      statRemaining.innerText = Math.max(0, limit - message.data.likesCount);
      updateProgressUI(message.data.likesCount, limit);
      break;

    case 'log':
      logToConsole(message.data.logType, message.data.text, message.data.time);
      break;

    case 'status_change':
      updateStatusUI(message.data.status);
      if (message.data.status === 'completed') {
        toggleControlsRunning(false);
        logToConsole('success', '✨ Goal reached! Liking session completed successfully.');
      } else if (message.data.status === 'stopped') {
        toggleControlsRunning(false);
      }
      break;
  }
}

// UI State Updates
function updateStatusUI(status) {
  statusDot.className = 'status-dot ' + status;
  statusText.innerText = status.toUpperCase();
}

function toggleControlsRunning(isRunning) {
  btnStart.disabled = isRunning;
  btnStop.disabled = !isRunning;
  
  // Disable configuration elements during active run
  likesLimitInput.disabled = isRunning;
  minDelayInput.disabled = isRunning;
  maxDelayInput.disabled = isRunning;
  autoScrollCheckbox.disabled = isRunning;
  presetButtons.forEach(btn => btn.disabled = isRunning);
  customSelectorInput.disabled = isRunning;
}

function disableAllControls() {
  btnStart.disabled = true;
  btnStop.disabled = true;
  btnRestart.disabled = true;
  likesLimitInput.disabled = true;
  minDelayInput.disabled = true;
  maxDelayInput.disabled = true;
  autoScrollCheckbox.disabled = true;
  presetButtons.forEach(btn => btn.disabled = true);
  customSelectorInput.disabled = true;
  updateStatusUI('stopped');
}

function updateProgressUI(liked, limit) {
  const percent = Math.min(100, Math.round((liked / limit) * 100)) || 0;
  progressBar.style.width = `${percent}%`;
  progressPercent.innerText = `${percent}% Completed`;
}

// Delay Form Validation
function validateDelays() {
  let min = parseFloat(minDelayInput.value);
  let max = parseFloat(maxDelayInput.value);

  if (min < 0.5) min = 0.5;
  if (max < min) max = min + 1;

  minDelayInput.value = min;
  maxDelayInput.value = max;
  saveSettings();
}

// Log message to activity terminal
function logToConsole(type, text, timestamp = null) {
  const now = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const logDiv = document.createElement('div');
  logDiv.className = `log-line ${type}`;
  logDiv.innerHTML = `<span style="color:#747d8c">[${now}]</span> ${text}`;
  
  consoleLogs.appendChild(logDiv);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Storage Helpers
function saveSettings() {
  const settings = {
    platform: activePlatform,
    customSelector: customSelectorInput.value,
    limit: parseInt(likesLimitInput.value),
    minDelay: parseFloat(minDelayInput.value),
    maxDelay: parseFloat(maxDelayInput.value),
    autoScroll: autoScrollCheckbox.checked
  };
  chrome.storage.local.set({ likerSettings: settings });
}

function loadSettings() {
  chrome.storage.local.get(['likerSettings'], (result) => {
    if (result.likerSettings) {
      const s = result.likerSettings;
      activePlatform = s.platform || 'fanime';
      
      presetButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.platform === activePlatform) {
          btn.classList.add('active');
        }
      });

      if (activePlatform === 'custom') {
        selectorWrapper.style.display = 'flex';
      } else {
        selectorWrapper.style.display = 'none';
      }

      customSelectorInput.value = s.customSelector || PLATFORM_PRESETS[activePlatform].selector;
      likesLimitInput.value = s.limit || 250;
      likesLimitVal.innerText = s.limit || 250;
      minDelayInput.value = s.minDelay || 2;
      maxDelayInput.value = s.maxDelay || 5;
      autoScrollCheckbox.checked = s.autoScroll !== undefined ? s.autoScroll : true;
      
      const currentLiked = parseInt(statLiked.innerText) || 0;
      statRemaining.innerText = Math.max(0, s.limit - currentLiked);
      updateProgressUI(currentLiked, s.limit);
    } else {
      // Default load: Fanime preset is active
      activePlatform = 'fanime';
      customSelectorInput.value = PLATFORM_PRESETS['fanime'].selector;
    }
  });
}
