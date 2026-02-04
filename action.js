// Constants
const EXTENSION_NAME = "Fullsize Image";
const DEFAULT_STATE = "active";
const IMAGE_REGEX = /\.(jpg|jpeg|png|gif)$/i;

// State management
let state = DEFAULT_STATE;

// Browser API compatibility (Chrome vs Firefox)
if (typeof browser === "undefined") {
	globalThis.browser = chrome;
}

// Initialize state from storage
async function initializeState() {
	try {
		const result = await browser.storage.local.get("state");
		state = result.state || DEFAULT_STATE;
		updateIcon(state);
	} catch (error) {
		console.error("Failed to initialize state:", error);
		state = DEFAULT_STATE;
	}
}

// Update extension icon based on state
function updateIcon(iconState) {
	const iconPath = iconState === "active" ? "icon-active.png" : "icon-sleeping.png";
	browser.action.setIcon({
		path: {
			"16": "icon-16.png",
			"48": "icon-48.png",
			"128": iconPath,
		},
	}).catch(error => {
		console.error("Failed to set icon:", error);
	});
}

// Update extension title based on state
function updateTitle(iconState) {
	const title = iconState === "active" ? EXTENSION_NAME : `${EXTENSION_NAME} (inactive)`;
	browser.action.setTitle({ title }).catch(error => {
		console.error("Failed to set title:", error);
	});
}

// Save state to storage
async function saveState() {
	try {
		await browser.storage.local.set({ state });
	} catch (error) {
		console.error("Failed to save state:", error);
	}
}

// Command functions that send messages to the content script
async function sendCommand(tabId, action) {
	try {
		// Try to send message to content script
		await browser.tabs.sendMessage(tabId, { action });
	} catch (error) {
		// Content script might not be loaded or ready
		console.log("Content script not ready, will be handled when loaded");
	}
}

// Handle click on extension icon
async function handleIconClick(tab) {
	try {
		const tabs = await browser.tabs.query({ active: true, currentWindow: true });
		const activeTab = tabs[0];
		if (!activeTab || !activeTab.url || !activeTab.id) return;

		const tabUrl = activeTab.url;
		const tabId = activeTab.id;

		// Toggle state
		state = state === "active" ? "sleeping" : "active";

		// Update UI
		updateIcon(state);
		updateTitle(state);

		// If current tab is an image, resize it immediately
		if (IMAGE_REGEX.test(tabUrl)) {
			const action = state === "active" ? "enlargeImage" : "shrinkImage";
			await sendCommand(tabId, action);
		}

		// Save state
		await saveState();
	} catch (error) {
		console.error("Error handling icon click:", error);
	}
}

// Handle messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "openImageInNewTab" && message.url) {
		// Open the image in a new tab
		browser.tabs.create({ url: message.url })
			.then(() => {
				// Close the original tab after opening the new one
				if (sender.tab && sender.tab.id) {
					browser.tabs.remove(sender.tab.id)
						.then(() => sendResponse({ success: true }))
						.catch(error => {
							console.error("Failed to close original tab:", error);
							sendResponse({ success: true }); // Still success for opening
						});
				} else {
					sendResponse({ success: true });
				}
			})
			.catch(error => {
				console.error("Failed to open image in new tab:", error);
				sendResponse({ success: false });
			});
		return true; // Keep channel open for async response
	}
});

// Initialize on load
initializeState();

// Add click listener
browser.action.onClicked.addListener(handleIconClick);
