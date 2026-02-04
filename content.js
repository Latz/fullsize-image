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
		const images = document.querySelectorAll("img");

		// If not a single-image page, show all images immediately
		if (images.length !== 1) {
			images.forEach(img => {
				img.style.visibility = "visible";
			});
			return;
		}

		if (!isActive) {
			// Extension is not active, show the image normally
			images[0].style.visibility = "visible";
			return;
		}

		const img = images[0];

		// Check if the image is likely a logo/icon based on filename or URL
		const src = img.src || img.currentSrc || window.location.href;
		const isLikelyLogo = /\b(logo|icon|favicon|badge|button|banner)\b/i.test(src);

		// Check for lazy-loaded images that haven't appeared yet
		const hasLazyImages = document.querySelector('[data-src], [data-lazy], [loading="lazy"], .lazyload, .lazy');

		// Check if this is a real webpage (not just a direct image file)
		// Direct image files have minimal DOM: html > body > img
		const bodyChildren = document.body.children;
		const isWebpage = bodyChildren.length > 1 ||
			(bodyChildren.length === 1 && bodyChildren[0].tagName !== 'IMG');

		// Don't enlarge if:
		// - Image is a logo/icon
		// - There are lazy-loaded images waiting to appear
		// - This is a webpage with content (not a direct image file)
		if (isLikelyLogo || hasLazyImages || isWebpage) {
			img.style.visibility = "visible";
			return;
		}

		// Only enlarge if image has reasonable dimensions
		if (img.naturalWidth > 50 && img.naturalHeight > 50) {
			// Check if it's not already enlarged
			const currentStyle = window.getComputedStyle(img);
			if (currentStyle.width !== "99vw") {
				applyEnlargeStyles(img);
			}
		} else {
			// Image too small, show it normally
			img.style.visibility = "visible";
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
		img.style.visibility = "visible";
	}

	function enlargeImage() {
		const images = document.querySelectorAll("img");
		if (images.length !== 1) return;
		const img = images[0];

		applyEnlargeStyles(img);
	}
})();
