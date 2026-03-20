// content.js — Chrome extension content script (ES module)
import {
  looksLikeBase64,
  tryDecodeBase64,
  findDominantImage,
  applyEnlargeStyles,
  showAllImages,
} from './content-logic.js';

let isActive = false;
let dominantRatio = 3;
let dominantImageOpened = false;
let dominantCheckTimer = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enlargeImage') {
    enlargeImage();
    sendResponse({ success: true });
  } else if (request.action === 'shrinkImage') {
    shrinkImage();
    sendResponse({ success: true });
  }
  return true;
});

chrome.storage.local.get(['state', 'excludedPages', 'excludedSites', 'dominantRatio'], (result) => {
  const state = result.state || 'active';
  const excludedPages = result.excludedPages || [];
  const excludedSites = result.excludedSites || [];
  dominantRatio = result.dominantRatio ?? 3;

  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname;
  const isPageExcluded = excludedPages.includes(currentUrl);
  const isSiteExcluded = excludedSites.includes(currentDomain);

  isActive = state === 'active' && !isPageExcluded && !isSiteExcluded;

  if (isActive) {
    startMonitoring();
  } else {
    showAllImages();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.state) {
    isActive = changes.state.newValue === 'active';
    if (!isActive) showAllImages();
  }
  if (changes.dominantRatio) {
    dominantRatio = changes.dominantRatio.newValue ?? 3;
  }
});

function startMonitoring() {
  const observer = new MutationObserver(() => { checkAndEnlarge(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('load', (event) => {
    if (event.target.tagName === 'IMG') {
      const images = document.querySelectorAll('img');
      if (images.length > 1) scheduleDominantCheck(images);
    }
  }, true);

  checkEncodedUrlParams();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => { checkAndEnlarge(); });
  });
}

function scheduleDominantCheck(images) {
  clearTimeout(dominantCheckTimer);
  dominantCheckTimer = setTimeout(() => checkForDominantImage(images), 600);
}

function checkEncodedUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const decodedParams = [];
  for (const [key, value] of urlParams) {
    if (looksLikeBase64(value)) {
      const results = tryDecodeBase64(value);
      if (results.length > 0) {
        decodedParams.push({ param: key, original: value, decoded: results });
        console.log(`Decoded parameter "${key}":`, results);
      }
    }
  }
  return decodedParams;
}

function checkForDominantImage(images) {
  if (!isActive || dominantImageOpened) return;

  const decodedParams = checkEncodedUrlParams();
  if (decodedParams.length > 0) {
    console.log('Page contains encoded URL parameters:', decodedParams);
  }

  const dominant = findDominantImage(Array.from(images), { dominantRatio });
  if (dominant) {
    dominantImageOpened = true;
    if (decodedParams.length > 0) {
      decodedParams.forEach(param => {
        param.decoded.forEach(result => {
          if (result.fullPath) {
            console.log(`Extracting dominant image from encoded page (${param.param}):`, result.fullPath);
          }
        });
      });
    }
    const imageUrl = dominant.src || dominant.currentSrc;
    chrome.runtime.sendMessage({ action: 'openImageInNewTab', url: imageUrl });
  }
}

function checkAndEnlarge() {
  const images = document.querySelectorAll('img');

  if (images.length !== 1) {
    scheduleDominantCheck(images);
    images.forEach(img => { img.style.visibility = 'visible'; });
    return;
  }

  if (!isActive) {
    images[0].style.visibility = 'visible';
    return;
  }

  const img = images[0];
  const src = img.src || img.currentSrc || window.location.href;
  const isLikelyLogo = /\b(logo|icon|favicon|badge|button|banner)\b/i.test(src);
  const hasLazyImages = document.querySelector('[data-src], [data-lazy], [loading="lazy"], .lazyload, .lazy');
  const bodyChildren = document.body.children;
  const isWebpage = bodyChildren.length > 1 ||
    (bodyChildren.length === 1 && bodyChildren[0].tagName !== 'IMG');

  if (isLikelyLogo || hasLazyImages || isWebpage) {
    img.style.visibility = 'visible';
    return;
  }

  if (img.naturalWidth > 50 && img.naturalHeight > 50) {
    const currentStyle = window.getComputedStyle(img);
    if (currentStyle.width !== '99vw') {
      applyEnlargeStyles(img);
    }
  } else {
    img.style.visibility = 'visible';
  }
}

function shrinkImage() {
  const images = document.querySelectorAll('img');
  if (images.length !== 1) return;
  const img = images[0];
  document.documentElement.classList.remove('enlarge-single-image');
  img.style.width = `${img.width}px`;
  img.style.height = `${img.height}px`;
  img.style.margin = 'auto';
  img.style.position = '';
  img.style.zIndex = '';
  img.style.top = '';
  img.style.left = '';
  img.style.background = '';
  img.style.visibility = 'visible';
}

function enlargeImage() {
  const images = document.querySelectorAll('img');
  if (images.length !== 1) return;
  applyEnlargeStyles(images[0]);
}
