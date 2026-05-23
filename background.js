// AuraLike Pro - Background Service Worker (Manifest V3)

// Listen for action triggers from content scripts or popup UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "show_notification") {
    // Construct and present a native operating system notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: message.title,
      message: message.message,
      priority: 2, // High priority to show popup immediately
      silent: false
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error("Notification trigger error: ", chrome.runtime.lastError.message);
      }
    });
    sendResponse({ status: "notification_shown" });
  }
  return true; // Keep message channel active for async reply
});

// Extension Installation lifecycle hook
chrome.runtime.onInstalled.addListener(() => {
  console.log("AuraLike Pro Engine initialized successfully.");
});
