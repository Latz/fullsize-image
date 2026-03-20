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
