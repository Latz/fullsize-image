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

		// Listen for image load events to re-check for dominant images
		document.addEventListener('load', (event) => {
			if (event.target.tagName === 'IMG') {
				// An image just finished loading, re-check for dominant images
				const images = document.querySelectorAll("img");
				if (images.length > 1) {
					checkForDominantImage(images);
				}
			}
		}, true); // Use capture phase to catch all load events

		// Check for any base64-encoded URL parameters and decode them
		checkEncodedUrlParams();

		// Also check immediately (for already loaded images)
		// Use requestAnimationFrame to ensure DOM is ready
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				checkAndEnlarge();
			});
		});
	}

	// Track if we've already opened a dominant image to avoid repeated opens
	let dominantImageOpened = false;

	// Try to decode a string using various base64 methods
	function tryDecodeBase64(encodedStr) {
		const results = [];

		try {
			// Remove any numeric prefix (like "101000")
			const withoutPrefix = encodedStr.replace(/^\d{6}/, '');

			// Method 1: Standard base64
			try {
				const decoded = atob(withoutPrefix);
				if (isPrintableString(decoded)) {
					results.push({ method: "standard base64", decoded: decoded });
				}
			} catch (e) {}

			// Method 2: URL-safe base64
			try {
				const urlSafe = withoutPrefix.replace(/-/g, '+').replace(/_/g, '/');
				const decoded = atob(urlSafe);
				if (isPrintableString(decoded)) {
					results.push({ method: "URL-safe base64", decoded: decoded });
				}
			} catch (e) {}

			// Method 3: Custom alphabet (0-9A-Za-z) - common obfuscation
			try {
				const customAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/";
				const standardAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

				const translated = withoutPrefix.split('').map(c => {
					const idx = customAlphabet.indexOf(c);
					return idx >= 0 ? standardAlphabet[idx] : c;
				}).join('');

				const decoded = atob(translated);
				if (isPrintableString(decoded)) {
					// Try to parse structured data
					const folderMatch = decoded.match(/folder_-_(.+?)_\._filename/);
					const filenameMatch = decoded.match(/filename_-_(.+?)\//);

					if (folderMatch && filenameMatch) {
						results.push({
							method: "custom base64 (0-9A-Za-z)",
							decoded: decoded,
							folder: folderMatch[1],
							filename: filenameMatch[1],
							fullPath: `${folderMatch[1]}/${filenameMatch[1]}`
						});
					} else {
						results.push({ method: "custom base64 (0-9A-Za-z)", decoded: decoded });
					}
				}
			} catch (e) {}

		} catch (error) {}

		return results;
	}

	// Check if a string contains mostly printable characters
	function isPrintableString(str) {
		if (!str || str.length < 3) return false;
		const printableCount = str.split('').filter(c => {
			const code = c.charCodeAt(0);
			return (code >= 32 && code <= 126) || code === 10 || code === 13;
		}).length;
		return printableCount / str.length > 0.7; // At least 70% printable
	}

	// Check if a string looks like it could be base64
	function looksLikeBase64(str) {
		if (!str || str.length < 10) return false;
		// Base64 uses A-Z, a-z, 0-9, +, /, -, _ and optional = padding
		return /^[A-Za-z0-9+/\-_]+=*$/.test(str);
	}

	// Check all URL parameters for base64-encoded strings
	function checkEncodedUrlParams() {
		const urlParams = new URLSearchParams(window.location.search);
		const decodedParams = [];

		for (const [key, value] of urlParams) {
			if (looksLikeBase64(value)) {
				const results = tryDecodeBase64(value);
				if (results.length > 0) {
					decodedParams.push({
						param: key,
						original: value,
						decoded: results
					});
					console.log(`Decoded parameter "${key}":`, results);
				}
			}
		}

		return decodedParams;
	}

	function checkForDominantImage(images) {
		if (!isActive || dominantImageOpened) return;

		// Check for any base64-encoded URL parameters
		const decodedParams = checkEncodedUrlParams();
		if (decodedParams.length > 0) {
			console.log("Page contains encoded URL parameters:", decodedParams);
		}

		// Filter out images that haven't loaded yet
		const loadedImages = Array.from(images).filter(img =>
			img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
		);

		if (loadedImages.length < 2) return;

		// Calculate areas and sort by size
		const imageData = loadedImages.map(img => ({
			img,
			area: img.naturalWidth * img.naturalHeight,
			width: img.naturalWidth,
			height: img.naturalHeight
		})).sort((a, b) => b.area - a.area);

		const largest = imageData[0];
		const secondLargest = imageData[1];

		// Check if one image is significantly larger (3x) and reasonably sized
		const isSignificantlyLarger = largest.area >= (secondLargest.area * 3);
		const isReasonablyLarge = largest.width >= 400 && largest.height >= 400;

		if (isSignificantlyLarger && isReasonablyLarge) {
			dominantImageOpened = true;

			// Convert image to data URL to cache it (avoid reloading from source)
			const canvas = document.createElement('canvas');
			canvas.width = largest.img.naturalWidth;
			canvas.height = largest.img.naturalHeight;
			const ctx = canvas.getContext('2d');

			try {
				ctx.drawImage(largest.img, 0, 0);
				const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

				// Log decoded URL info if available
				if (decodedParams.length > 0) {
					decodedParams.forEach(param => {
						param.decoded.forEach(result => {
							if (result.fullPath) {
								console.log(`Extracting dominant image from encoded page (${param.param}):`, result.fullPath);
							}
						});
					});
				}

				// Send message to background script to open in new tab with cached data
				chrome.runtime.sendMessage({
					action: "openImageInNewTab",
					url: dataUrl
				});
			} catch (error) {
				// CORS error or other issue - fall back to original URL
				console.log("Could not cache image (CORS?), using original URL");
				chrome.runtime.sendMessage({
					action: "openImageInNewTab",
					url: largest.img.src || largest.img.currentSrc
				});
			}
		}
	}

	function checkAndEnlarge() {
		const images = document.querySelectorAll("img");

		// If not a single-image page, check for dominant image
		if (images.length !== 1) {
			checkForDominantImage(images);
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
