# ⚡ AuraLike Pro — Auto Liker Chrome/Edge Extension

**AuraLike Pro** is an ultra-premium, dark-themed Chrome and Microsoft Edge extension designed to automate post liking with a highly customizable, human-like interaction engine. Featuring dynamic platform presets, intelligent state synchronization, safety boundaries, and a real-time glowing activity console.

---

## ✨ Features

* **Platform Presets:** Out-of-the-box support for the target site **Fanime** (natively pre-mapped), **LinkedIn**, **Instagram**, and **Twitter/X** with intelligent click-safety checks.
* **Auto-Scrolling:** Seamless smooth scrolling to automatically discover and load new content when the current view is fully interacted with.
* **Smart Delays:** Fully configurable, randomized delay boundaries (e.g. wait between 2.0s and 5.5s) to mimic authentic human clicking.
* **Dynamic Threshold Limits:** Set a target liking threshold of up to **700 likes** using an interactive neon slider.
* **State Synchronization:** The automation engine runs directly inside the webpage tab. Closing the popup will **not** interrupt the liking cycle. Reopening the popup instantly synchronizes stats and logs.
* **Safety Aborts:** Automatically ceases scrolling if the feed runs dry or if rate-limiting is detected, protecting your profile's reputation.
* **System-Level Alerts:** Sends gorgeous, native operating system notifications (macOS / Windows) when your liked goals are successfully achieved.

---

## 🚀 Installation Guide

Loading AuraLike Pro into your browser takes less than a minute:

1. Open your browser (**Google Chrome** or **Microsoft Edge**).
2. Navigate to the extensions manager by visiting:
   * **Chrome:** `chrome://extensions`
   * **Edge:** `edge://extensions`
3. In the top-right corner of the page, toggle the **Developer mode** switch **ON**.
4. In the top-left corner, click the **Load unpacked** button.
5. In the file explorer, navigate to and select the following folder:
   `/Users/devanshvpurohit/auto-liker-extension`
6. Click **Select Folder / Open**. AuraLike Pro's heart icon will now appear in your browser toolbar! (Pin it for easy access).

---

## 🖥️ Inside the Cybernetic Dashboard

```
 ┌──────────────────────────────────────┐
 │ AuraLike PRO              [ RUNNING ]│ <-- Pulsing Cyan/Green Live Indicator
 ├──────────────────────────────────────┤
 │ Preset: [Fanime] [LI] [IG] [X] [Cust]│ <-- One-click targeting
 │ Selector: button[aria-label="Like"]  │
 ├──────────────────────────────────────┤
 │ Slider: Limit [ =====o== ]  250/700  │ <-- Customizable like target threshold
 │ Delays: Min [ 2.0s ]   Max [ 5.0s ]  │ <-- Mimic organic user rhythms
 ├──────────────────────────────────────┤
 │ LIKED: 42   REMAINING: 208  SCROLLS:3│ <-- Live dynamic metric counters
 │ Progress: [██████░░░░░░░░░░]  16.8%  │ <-- Multi-gradient progress track
 ├──────────────────────────────────────┤
 │ > [19:28:01] Deploying platform...   │
 │ > [19:28:03] Liked post #1 on feed!  │ <-- Beautiful scrollable terminal console
 │ > [19:28:06] Cooling down for 3.4s...│
 └──────────────────────────────────────┘
```

---

## 🛠️ How to Customize Selector for Any Webpage

If your target website undergoes an update, or you want to automate a new platform entirely:

1. Open the target website and locate the **Like** button of a post.
2. **Right-click** on the Like button and select **Inspect** (or press `F12` to open Developer Tools).
3. In the Element Inspector tab, identify a unique CSS selector for the Like button. 
   * *Example:* If the HTML is `<button class="action-btn like-trigger">Like</button>`, your selector could be `button.like-trigger`.
   * *Pro-tip:* You can right-click the HTML element in DevTools, select **Copy**, and choose **Copy selector**.
4. Open the AuraLike Pro popup, click the **Custom** preset, and paste your CSS selector directly into the input field.
5. Adjust your limits/delays and press **Start**!

---

## 🛡️ Safe Usage Guidelines

1. **Keep Page Active:** To guarantee background automation speed, ensure the target tab remains open in your active browser window.
2. **Organic Limits:** Although AuraLike Pro supports up to 700 likes, we recommend starting with smaller targets (e.g. 100 - 250 likes per session) to comply with standard platform guidelines.
3. **Generous Delays:** To keep your account completely safe, use a delay of at least `2.5s - 6.0s`.

---

*AuraLike Pro is created with extreme design fidelity and lightweight performance. Ready for deployment.*
