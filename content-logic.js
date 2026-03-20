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
