// test/content-logic.test.js
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { isBackgroundStyleImage, isSvgImage, isPrintableString, looksLikeBase64, tryDecodeBase64 } from '../content-logic.js';

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
    // Build a string whose standard base64 contains + or /
    const standard = btoa('Hello+World/Test');
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_');
    const results = tryDecodeBase64(urlSafe);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.method === 'URL-safe base64')).toBe(true);
  });

  it('strips a leading 6-digit numeric prefix before decoding', () => {
    const encoded = '101000' + btoa('Hello World');
    const results = tryDecodeBase64(encoded);
    expect(results.some(r => r.decoded.includes('Hello World'))).toBe(true);
  });

  it('returns result objects with at least method and decoded keys', () => {
    const results = tryDecodeBase64('SGVsbG8gV29ybGQ=');
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r).toHaveProperty('method');
      expect(r).toHaveProperty('decoded');
    });
  });

  it('extracts folder and filename from custom-alphabet encoding', () => {
    const payload = 'folder_-_myfolder_._filenameXXXXfilename_-_myfile.jpg/';
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
