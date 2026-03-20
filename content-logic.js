// content-logic.js
// Pure/testable functions extracted from content.js

/**
 * Returns true if the img is used as a decorative background —
 * i.e., object-fit:cover, or absolutely/fixed positioned covering >50% of viewport.
 */
export function isBackgroundStyleImage(img) {
  const style = window.getComputedStyle(img);
  if (style.objectFit === 'cover') return true;
  const pos = style.position;
  if (pos === 'absolute' || pos === 'fixed') {
    const rect = img.getBoundingClientRect();
    const viewportArea = window.innerWidth * window.innerHeight;
    const imgArea = rect.width * rect.height;
    if (imgArea / viewportArea > 0.5) return true;
  }
  return false;
}

/**
 * Returns true if the img src (or currentSrc) is an SVG file or data URI.
 */
export function isSvgImage(img) {
  const src = img.src || img.currentSrc || '';
  return /\.svg(\?|$)/i.test(src) || src.startsWith('data:image/svg');
}

/**
 * Returns true if str contains ≥70% printable ASCII characters and length ≥3.
 */
export function isPrintableString(str) {
  if (!str || str.length < 3) return false;
  const printableCount = str.split('').filter(c => {
    const code = c.charCodeAt(0);
    return (code >= 32 && code <= 126) || code === 10 || code === 13;
  }).length;
  return printableCount / str.length > 0.7;
}

/**
 * Returns true if str looks like a base64 value (valid chars, length ≥10).
 */
export function looksLikeBase64(str) {
  if (!str || str.length < 10) return false;
  return /^[A-Za-z0-9+/\-_]+=*$/.test(str);
}

/**
 * Attempts to decode str as standard base64, URL-safe base64, and a custom
 * 0-9A-Za-z alphabet variant. Strips a leading 6-digit numeric prefix first.
 * Returns an array of { method, decoded, folder?, filename?, fullPath? }.
 */
export function tryDecodeBase64(encodedStr) {
  const results = [];
  try {
    const withoutPrefix = encodedStr.replace(/^\d{6}/, '');

    try {
      const decoded = atob(withoutPrefix);
      if (isPrintableString(decoded)) {
        results.push({ method: 'standard base64', decoded });
      }
    } catch (e) {}

    try {
      const urlSafe = withoutPrefix.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(urlSafe);
      if (isPrintableString(decoded)) {
        results.push({ method: 'URL-safe base64', decoded });
      }
    } catch (e) {}

    try {
      const customAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/';
      const standardAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const translated = withoutPrefix.split('').map(c => {
        const idx = customAlphabet.indexOf(c);
        return idx >= 0 ? standardAlphabet[idx] : c;
      }).join('');
      const decoded = atob(translated);
      if (isPrintableString(decoded)) {
        const folderMatch = decoded.match(/folder_-_(.+?)_\._filename/);
        const filenameMatch = decoded.match(/filename_-_(.+?)\//);
        if (folderMatch && filenameMatch) {
          results.push({
            method: 'custom base64 (0-9A-Za-z)',
            decoded,
            folder: folderMatch[1],
            filename: filenameMatch[1],
            fullPath: `${folderMatch[1]}/${filenameMatch[1]}`,
          });
        } else {
          results.push({ method: 'custom base64 (0-9A-Za-z)', decoded });
        }
      }
    } catch (e) {}
  } catch (error) {}
  return results;
}

/**
 * Analyzes a list of img elements and returns the single dominant image, or null.
 *
 * "Dominant" means one image is significantly larger than all others:
 * - On gallery pages (4+ images of similar size), only returns an image if it's a
 *   clear outlier above the cluster (>= medianArea × dominantRatio × 2).
 * - On non-gallery pages, largest must be >= secondLargest × dominantRatio.
 * - The winner must also be at least 400×400px.
 *
 * Excludes: SVGs, background-style images, and images < 2,500px².
 *
 * @param {HTMLImageElement[]} imageElements
 * @param {{ dominantRatio?: number }} opts
 * @returns {HTMLImageElement|null}
 */
export function findDominantImage(imageElements, { dominantRatio = 3 } = {}) {
  // Filter: loaded, non-SVG, non-background
  const loadedImages = imageElements.filter(img => {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return false;
    if (isSvgImage(img)) return false;
    if (isBackgroundStyleImage(img)) return false;
    return true;
  });

  if (loadedImages.length < 2) return null;

  // Sort by area descending
  const imageData = loadedImages.map(img => ({
    img,
    area: img.naturalWidth * img.naturalHeight,
    width: img.naturalWidth,
    height: img.naturalHeight,
  })).sort((a, b) => b.area - a.area);

  // Filter out tiny images (tracking pixels, icons < 2,500px²) from cluster analysis
  const meaningfulImages = imageData.filter(d => d.area >= 2500);
  if (meaningfulImages.length < 2) return null;

  const largest = meaningfulImages[0];
  const secondLargest = meaningfulImages[1];

  // Detect gallery cluster (4+ images within 0.4–2.5× of median area)
  const sortedAreas = meaningfulImages.map(d => d.area).sort((a, b) => a - b);
  const medianArea = sortedAreas[Math.floor(sortedAreas.length / 2)];
  const clusterCount = meaningfulImages.filter(d =>
    d.area >= medianArea * 0.4 && d.area <= medianArea * 2.5
  ).length;
  const isGalleryCluster = clusterCount >= 4;

  let isSignificantlyLarger;
  if (isGalleryCluster) {
    // Gallery: largest must be a clear outlier above the cluster
    if (largest.area <= medianArea * 2.5) return null; // largest is just another thumbnail
    isSignificantlyLarger = largest.area >= medianArea * dominantRatio * 2;
  } else {
    isSignificantlyLarger = largest.area >= secondLargest.area * dominantRatio;
  }

  const isReasonablyLarge = largest.width >= 400 && largest.height >= 400;

  return (isSignificantlyLarger && isReasonablyLarge) ? largest.img : null;
}

/**
 * Applies full-viewport enlargement styles to a single image.
 * Adds 'enlarge-single-image' class to <html> and reveals the image
 * after a double requestAnimationFrame to avoid flash.
 */
export function applyEnlargeStyles(img) {
  document.documentElement.classList.add('enlarge-single-image');
  img.style.width = '99vw';
  img.style.height = '99vh';
  img.style.objectFit = 'contain';
  img.style.zIndex = '9999';
  img.style.position = 'fixed';
  img.style.top = '0';
  img.style.left = '0';
  img.style.background = '#000';
  img.style.margin = '0';
  img.style.padding = '0';
  img.style.border = 'none';
  void img.offsetWidth;
  void img.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.style.visibility = 'visible';
    });
  });
}

/**
 * Sets visibility:visible on all current and future <img> elements.
 * Used when the extension is disabled to undo the default CSS hide rule.
 */
export function showAllImages() {
  document.querySelectorAll('img').forEach(img => {
    img.style.visibility = 'visible';
  });
  const observer = new MutationObserver(() => {
    document.querySelectorAll('img').forEach(img => {
      img.style.visibility = 'visible';
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
