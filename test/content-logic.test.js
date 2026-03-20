// test/content-logic.test.js
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { isBackgroundStyleImage, isSvgImage, isPrintableString, looksLikeBase64, tryDecodeBase64, findDominantImage, applyEnlargeStyles, showAllImages } from '../content-logic.js';

// Helper: create img element appended to body with optional inline styles
function makeImg({ objectFit = '', position = '', src = 'https://example.com/photo.jpg' } = {}) {
  const img = document.createElement('img');
  if (objectFit) img.style.objectFit = objectFit;
  if (position) img.style.position = position;
  Object.defineProperty(img, 'src', { value: src, configurable: true });
  Object.defineProperty(img, 'currentSrc', { value: src, configurable: true });
  Object.defineProperty(img, 'getBoundingClientRect', {
    value: () => ({ width: 0, height: 0 }),
    configurable: true,
  });
  return img;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isBackgroundStyleImage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    vi.spyOn(window, 'getComputedStyle').mockImplementation(el => ({
      objectFit: el.style.objectFit || '',
      position: el.style.position || '',
    }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns true when object-fit is cover', () => {
    const img = makeImg({ objectFit: 'cover' });
    expect(isBackgroundStyleImage(img)).toBe(true);
  });

  it('returns true when position is fixed and covers >50% of viewport', () => {
    const img = makeImg({ position: 'fixed' });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ width: 1000, height: 700 }),
      configurable: true,
    });
    expect(isBackgroundStyleImage(img)).toBe(true);
  });

  it('returns true when position is absolute and covers >50% of viewport', () => {
    const img = makeImg({ position: 'absolute' });
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ width: 1000, height: 700 }),
      configurable: true,
    });
    expect(isBackgroundStyleImage(img)).toBe(true);
  });

  it('returns false when position is fixed but covers ≤50% of viewport', () => {
    const img = makeImg({ position: 'fixed' });
    // 800×400 = 320,000 / 786,432 ≈ 40% — below the 50% threshold
    Object.defineProperty(img, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 400 }),
      configurable: true,
    });
    expect(isBackgroundStyleImage(img)).toBe(false);
  });

  it('returns false for a normal in-flow image', () => {
    const img = makeImg();
    expect(isBackgroundStyleImage(img)).toBe(false);
  });
});

describe('isSvgImage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns true for .svg URL via img.src', () => {
    const img = makeImg({ src: 'https://example.com/icon.svg' });
    expect(isSvgImage(img)).toBe(true);
  });

  it('returns true for .svg URL via img.currentSrc when src is empty', () => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'src', { value: '', configurable: true });
    Object.defineProperty(img, 'currentSrc', { value: 'https://example.com/icon.svg', configurable: true });
    expect(isSvgImage(img)).toBe(true);
  });

  it('returns true for data:image/svg+xml URI', () => {
    const img = makeImg({ src: 'data:image/svg+xml,<svg/>' });
    expect(isSvgImage(img)).toBe(true);
  });

  it('returns false for a non-SVG URL', () => {
    const img = makeImg({ src: 'https://example.com/photo.jpg' });
    expect(isSvgImage(img)).toBe(false);
  });
});

describe('isPrintableString', () => {
  it('returns true for readable ASCII text', () => {
    expect(isPrintableString('Hello, world!')).toBe(true);
  });

  it('returns false for binary-heavy strings', () => {
    const binary = String.fromCharCode(0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
    expect(isPrintableString(binary)).toBe(false);
  });

  it('returns false for strings shorter than 3 chars', () => {
    expect(isPrintableString('ab')).toBe(false);
    expect(isPrintableString('')).toBe(false);
    expect(isPrintableString(null)).toBe(false);
  });
});

describe('looksLikeBase64', () => {
  it('returns true for a valid base64 string of length >= 10', () => {
    expect(looksLikeBase64('SGVsbG8gV29ybGQ=')).toBe(true);
  });

  it('returns false for a plain URL (colon is not in the allowed character set)', () => {
    expect(looksLikeBase64('https://example.com/image.jpg')).toBe(false);
  });

  it('returns false for strings shorter than 10 chars', () => {
    expect(looksLikeBase64('abc')).toBe(false);
    expect(looksLikeBase64('')).toBe(false);
    expect(looksLikeBase64(null)).toBe(false);
  });
});

describe('tryDecodeBase64', () => {
  it('decodes standard base64 to a readable string', () => {
    // btoa('Hello World') === 'SGVsbG8gV29ybGQ='
    const results = tryDecodeBase64('SGVsbG8gV29ybGQ=');
    expect(results.some(r => r.decoded.includes('Hello World'))).toBe(true);
  });

  it('decodes URL-safe base64 with - and _ variants', () => {
    // '>>>' encodes to 'Pj4+' in standard base64 (the + is in the encoded output)
    // URL-safe form 'Pj4-' would fail atob directly but succeeds after - → + conversion
    const urlSafe = 'Pj4-';
    const results = tryDecodeBase64(urlSafe);
    expect(results.some(r => r.method === 'URL-safe base64')).toBe(true);
    expect(results.some(r => r.decoded === '>>>')).toBe(true);
  });

  it('strips a leading 6-digit numeric prefix before decoding', () => {
    const encoded = '101000' + btoa('Hello World');
    const results = tryDecodeBase64(encoded);
    expect(results.some(r => r.decoded.includes('Hello World'))).toBe(true);
  });

  it('extracts folder and filename from custom-alphabet encoding', () => {
    const payload = 'folder_-_myfolder_._filename_-_myfile.jpg/';
    const customAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/';
    const standardAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const standard = btoa(payload);
    const customEncoded = standard.split('').map(c => {
      const idx = standardAlphabet.indexOf(c);
      return idx >= 0 ? customAlphabet[idx] : c;
    }).join('');

    const results = tryDecodeBase64(customEncoded);
    const customResult = results.find(r => r.method === 'custom base64 (0-9A-Za-z)');
    expect(customResult).toBeDefined();
    expect(customResult.folder).toBe('myfolder');
    expect(customResult.filename).toBe('myfile.jpg');
    expect(customResult.fullPath).toBe('myfolder/myfile.jpg');
  });
});

/**
 * Creates a mock img element with the given pixel dimensions and src.
 * getBoundingClientRect returns 0×0 by default so isBackgroundStyleImage
 * will not flag these as background images.
 */
function makeLoadedImg({
  naturalWidth = 800,
  naturalHeight = 600,
  src = 'https://example.com/photo.jpg',
} = {}) {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  Object.defineProperty(img, 'complete', { value: true, configurable: true });
  Object.defineProperty(img, 'src', { value: src, configurable: true });
  Object.defineProperty(img, 'currentSrc', { value: src, configurable: true });
  Object.defineProperty(img, 'getBoundingClientRect', {
    value: () => ({ width: 0, height: 0 }),
    configurable: true,
  });
  return img;
}

describe('findDominantImage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    // isBackgroundStyleImage (called by findDominantImage) uses getComputedStyle;
    // stub it so all non-background test elements pass through cleanly.
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ objectFit: '', position: '' }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('returns null when fewer than 2 meaningful images', () => {
    // Only 1 image after filtering — cannot determine dominance
    expect(findDominantImage([makeLoadedImg({ naturalWidth: 800, naturalHeight: 600 })])).toBeNull();
  });

  it('returns null when all images cluster together (gallery — largest inside cluster)', () => {
    // 6 images all 300×200 = 60,000px² — median=60,000, clusterCount=6 ≥4, largest inside cluster
    const imgs = Array.from({ length: 6 }, () =>
      makeLoadedImg({ naturalWidth: 300, naturalHeight: 200 })
    );
    expect(findDominantImage(imgs)).toBeNull();
  });

  it('returns null when largest is within 2.5× of median (still inside cluster)', () => {
    // 4 at 300×200 (60,000) + 1 at 400×300 (120,000 = 2.0× median) — within 2.5× threshold
    const imgs = [
      makeLoadedImg({ naturalWidth: 400, naturalHeight: 300 }),
      ...Array.from({ length: 4 }, () => makeLoadedImg({ naturalWidth: 300, naturalHeight: 200 })),
    ];
    expect(findDominantImage(imgs)).toBeNull();
  });

  it('returns dominant image when gallery cluster exists but largest is a clear outlier', () => {
    // 5 thumbnails at 150×100 (15,000px²) + 1 main at 800×600 (480,000px²)
    // median=15,000; 480,000 >= 15,000×3×2=90,000 ✓; 800×600 >= 400×400 ✓
    const main = makeLoadedImg({
      naturalWidth: 800,
      naturalHeight: 600,
      src: 'https://example.com/main.jpg',
    });
    const thumbnails = Array.from({ length: 5 }, () =>
      makeLoadedImg({ naturalWidth: 150, naturalHeight: 100 })
    );
    expect(findDominantImage([main, ...thumbnails])).toBe(main);
  });

  it('returns dominant image when no gallery cluster and largest exceeds ratio', () => {
    // 800×600 (480,000) vs 200×150 (30,000); 480,000/30,000=16 ≥3 ✓; 800×600 ≥400×400 ✓
    const large = makeLoadedImg({ naturalWidth: 800, naturalHeight: 600 });
    const small = makeLoadedImg({ naturalWidth: 200, naturalHeight: 150 });
    expect(findDominantImage([large, small])).toBe(large);
  });

  it('returns null when largest passes area ratio but is smaller than 400×400 (isReasonablyLarge gate)', () => {
    // 300×300 (90,000) vs 100×100 (10,000); 90,000/10,000=9 ≥3, but 300 < 400 ✗
    const large = makeLoadedImg({ naturalWidth: 300, naturalHeight: 300 });
    const small = makeLoadedImg({ naturalWidth: 100, naturalHeight: 100 });
    expect(findDominantImage([large, small])).toBeNull();
  });

  it('excludes SVG images from candidates', () => {
    // SVG excluded → only 1 meaningful image remains → null
    const svg = makeLoadedImg({
      naturalWidth: 800,
      naturalHeight: 600,
      src: 'https://example.com/icon.svg',
    });
    const small = makeLoadedImg({ naturalWidth: 200, naturalHeight: 150 });
    expect(findDominantImage([svg, small])).toBeNull();
  });

  it('excludes background-style images (object-fit: cover) from candidates', () => {
    const bg = makeLoadedImg({ naturalWidth: 1920, naturalHeight: 1080 });
    bg.style.objectFit = 'cover';
    document.body.appendChild(bg);
    // Stub getComputedStyle to reflect inline style (jsdom may not cascade objectFit)
    vi.spyOn(window, 'getComputedStyle').mockImplementation(el => ({
      objectFit: el.style.objectFit || '',
      position: el.style.position || '',
    }));
    const small = makeLoadedImg({ naturalWidth: 200, naturalHeight: 150 });
    expect(findDominantImage([bg, small])).toBeNull();
    vi.restoreAllMocks();
  });

  it('excludes images with area <2500px² from cluster analysis', () => {
    // 15 tiny images (40×40=1,600px², below 2,500 threshold) + 1 large
    // After filtering: only 1 meaningful image → null
    const tiny = Array.from({ length: 15 }, () =>
      makeLoadedImg({ naturalWidth: 40, naturalHeight: 40 })
    );
    const large = makeLoadedImg({ naturalWidth: 800, naturalHeight: 600 });
    expect(findDominantImage([...tiny, large])).toBeNull();
  });

  it('returns null when dominantRatio is set high enough to prevent match', () => {
    // 480,000 / 30,000 = 16; ratio=20 → 16 < 20 → null
    const large = makeLoadedImg({ naturalWidth: 800, naturalHeight: 600 });
    const small = makeLoadedImg({ naturalWidth: 200, naturalHeight: 150 });
    expect(findDominantImage([large, small], { dominantRatio: 20 })).toBeNull();
  });

  it('returns dominant when dominantRatio is default (3)', () => {
    const large = makeLoadedImg({ naturalWidth: 800, naturalHeight: 600 });
    const small = makeLoadedImg({ naturalWidth: 200, naturalHeight: 150 });
    expect(findDominantImage([large, small], { dominantRatio: 3 })).toBe(large);
  });
});

describe('applyEnlargeStyles', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.classList.remove('enlarge-single-image');
  });

  it('sets width, height, objectFit, position, and zIndex on the image', () => {
    const img = document.createElement('img');
    document.body.appendChild(img);
    applyEnlargeStyles(img);
    expect(img.style.width).toBe('99vw');
    expect(img.style.height).toBe('99vh');
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.position).toBe('fixed');
    expect(img.style.zIndex).toBe('9999');
  });

  it('sets top, left, background, margin, padding, border', () => {
    const img = document.createElement('img');
    document.body.appendChild(img);
    applyEnlargeStyles(img);
    expect(img.style.top).toBe('0px');
    expect(img.style.left).toBe('0px');
    expect(img.style.background).toBe('rgb(0, 0, 0)');
    expect(img.style.margin).toBe('0px');
    expect(img.style.padding).toBe('0px');
    // jsdom does not support 'border: none' — setting it leaves the property empty
    expect(img.style.border).toBe('');
  });

  it('adds enlarge-single-image class to document.documentElement', () => {
    const img = document.createElement('img');
    document.body.appendChild(img);
    applyEnlargeStyles(img);
    expect(document.documentElement.classList.contains('enlarge-single-image')).toBe(true);
  });

  it('sets visibility to visible after rAF (synchronous in tests due to stub)', () => {
    const img = document.createElement('img');
    document.body.appendChild(img);
    // requestAnimationFrame is stubbed in setup.js as vi.fn(cb => cb()) — runs synchronously
    applyEnlargeStyles(img);
    expect(img.style.visibility).toBe('visible');
  });
});

describe('showAllImages', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sets visibility:visible on all existing img elements', () => {
    const img1 = document.createElement('img');
    const img2 = document.createElement('img');
    document.body.appendChild(img1);
    document.body.appendChild(img2);
    showAllImages();
    expect(img1.style.visibility).toBe('visible');
    expect(img2.style.visibility).toBe('visible');
  });

  it('sets visibility:visible on img elements added after the call', async () => {
    showAllImages();
    const img = document.createElement('img');
    document.body.appendChild(img);
    // jsdom MutationObserver fires as a microtask — flush before asserting
    await Promise.resolve();
    expect(img.style.visibility).toBe('visible');
  });
});
