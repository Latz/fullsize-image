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
  document.body.appendChild(img);
  return img;
}

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

  it('returns false for .jpg URL', () => {
    const img = makeImg({ src: 'https://example.com/photo.jpg' });
    expect(isSvgImage(img)).toBe(false);
  });

  it('returns false for .png URL', () => {
    const img = makeImg({ src: 'https://example.com/image.png' });
    expect(isSvgImage(img)).toBe(false);
  });
});
