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

// Script functions to inject into the page
function shrinkImage() {
	const img = document.querySelector("img");
	if (!img) return;
	img.style.width = `${img.width}px`;
	img.style.height = `${img.height}px`;
	img.style.margin = "auto";
}

function enlargeImage() {
	const img = document.querySelector("img");
	if (!img) return;
	img.style.width = "99vw";
	img.style.height = "99vh";
	img.style.objectFit = "contain";
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
			const func = state === "active" ? enlargeImage : shrinkImage;
			await browser.scripting.executeScript({
				target: { tabId },
				func,
			});
		}

		// Save state
		await saveState();
	} catch (error) {
		console.error("Error handling icon click:", error);
	}
}

// Listen for tab updates to auto-enlarge images on regular pages
async function handleTabUpdate(tabId, changeInfo, tab) {
	// Only process when page is fully loaded and extension is active
	if (changeInfo.status !== "complete" || state !== "active") return;
	if (!tab.url || !tabId) return;

	// Check if the page contains images and we should auto-enlarge them
	// This runs on all pages, not just image URLs
	try {
		await browser.scripting.executeScript({
			target: { tabId },
			func: () => {
				// Find all images on the page
				const images = document.querySelectorAll("img");
				images.forEach(img => {
					// Only enlarge if image has reasonable dimensions
					if (img.naturalWidth > 50 && img.naturalHeight > 50) {
						// Check if it's not already enlarged
						const currentStyle = window.getComputedStyle(img);
						if (currentStyle.width !== "99vw") {
							img.style.width = "99vw";
							img.style.height = "99vh";
							img.style.objectFit = "contain";
							img.style.zIndex = "9999";
							img.style.position = "fixed";
							img.style.top = "0";
							img.style.left = "0";
							img.style.background = "black";
						}
					}
				});
			},
		});
	} catch (error) {
		// Ignore errors - page might not have permission to access
	}
}

// Initialize on load
initializeState();

// Add click listener
browser.action.onClicked.addListener(handleIconClick);

// Add tab update listener for auto-enlarging images
browser.tabs.onUpdated.addListener(handleTabUpdate);
