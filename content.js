// Content script that runs on document_start
// Sets up black background and monitors for single images

(function() {
	// Flag to track if we should process images
	let isActive = false;

	// Listen for messages from the background script
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === "enlargeImage") {
			enlargeImage();
			sendResponse({ success: true });
		} else if (request.action === "shrinkImage") {
			shrinkImage();
			sendResponse({ success: true });
		}
		return true;
	});

	// Check extension state on load
	chrome.storage.local.get("state", (result) => {
		isActive = (result.state || "active") === "active";

		if (isActive) {
			// Start monitoring for images
			startMonitoring();
		}
	});

	// Also listen for state changes
	chrome.storage.onChanged.addListener((changes) => {
		if (changes.state) {
			isActive = changes.state.newValue === "active";
		}
	});

	function startMonitoring() {
		// Use MutationObserver to detect when images are added
		const observer = new MutationObserver((mutations) => {
			checkAndEnlarge();
		});

		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
		});

		// Also check immediately (for already loaded images)
		// Use requestAnimationFrame to ensure DOM is ready
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				checkAndEnlarge();
			});
		});
	}

	function checkAndEnlarge() {
		if (!isActive) return;

		const images = document.querySelectorAll("img");

		// Only process if there's exactly one image on the page
		if (images.length !== 1) return;

		const img = images[0];

		// Only enlarge if image has reasonable dimensions
		if (img.naturalWidth > 50 && img.naturalHeight > 50) {
			// Check if it's not already enlarged
			const currentStyle = window.getComputedStyle(img);
			if (currentStyle.width !== "99vw") {
				applyEnlargeStyles(img);
			}
		}
	}

	function applyEnlargeStyles(img) {
		// Add class to html to trigger CSS that hides images during enlargement
		document.documentElement.classList.add("enlarge-single-image");

		// Apply all styles
		img.style.width = "99vw";
		img.style.height = "99vh";
		img.style.objectFit = "contain";
		img.style.zIndex = "9999";
		img.style.position = "fixed";
		img.style.top = "0";
		img.style.left = "0";
		img.style.background = "#000";
		img.style.margin = "0";
		img.style.padding = "0";
		img.style.border = "none";

		// Force reflows
		void img.offsetWidth;
		void img.offsetHeight;

		// Show image on next animation frame after it's been enlarged
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				img.style.visibility = "visible";
			});
		});
	}

	function shrinkImage() {
		const images = document.querySelectorAll("img");
		if (images.length !== 1) return;
		const img = images[0];

		// Remove the enlargement class
		document.documentElement.classList.remove("enlarge-single-image");

		img.style.width = `${img.width}px`;
		img.style.height = `${img.height}px`;
		img.style.margin = "auto";
		img.style.position = "";
		img.style.zIndex = "";
		img.style.top = "";
		img.style.left = "";
		img.style.background = "";
	}

	function enlargeImage() {
		const images = document.querySelectorAll("img");
		if (images.length !== 1) return;
		const img = images[0];

		applyEnlargeStyles(img);
	}
})();
