// test/content-logic.test.js
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { isBackgroundStyleImage, isSvgImage } from '../content-logic.js';

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
