// test/action.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reset module cache and chrome stubs before every test so module-level
// `state` in action.js starts fresh at DEFAULT_STATE ('active').
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  global.chrome.storage.local._store = {};
});

describe('updateIcon', () => {
  it('calls setIcon with icon-active.png path object for active state', async () => {
    const { updateIcon } = await import('../action.js');
    updateIcon('active');
    expect(global.chrome.action.setIcon).toHaveBeenCalledWith({
      path: { '16': 'icon-16.png', '48': 'icon-48.png', '128': 'icon-active.png' },
    });
  });

  it('calls setIcon with icon-sleeping.png path object for sleeping state', async () => {
    const { updateIcon } = await import('../action.js');
    updateIcon('sleeping');
    expect(global.chrome.action.setIcon).toHaveBeenCalledWith({
      path: { '16': 'icon-16.png', '48': 'icon-48.png', '128': 'icon-sleeping.png' },
    });
  });
});

describe('updateTitle', () => {
  it('calls setTitle with "Fullsize Image" for active state', async () => {
    const { updateTitle } = await import('../action.js');
    updateTitle('active');
    expect(global.chrome.action.setTitle).toHaveBeenCalledWith({ title: 'Fullsize Image' });
  });

  it('calls setTitle with "Fullsize Image (inactive)" for sleeping state', async () => {
    const { updateTitle } = await import('../action.js');
    updateTitle('sleeping');
    expect(global.chrome.action.setTitle).toHaveBeenCalledWith({ title: 'Fullsize Image (inactive)' });
  });
});

describe('handleIconClick', () => {
  it('toggles state from active to sleeping and saves to storage', async () => {
    global.chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/page.html' }]);
    const { handleIconClick } = await import('../action.js');
    await handleIconClick();
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ state: 'sleeping' });
  });

  it('toggles state from sleeping to active and saves to storage', async () => {
    // Pre-seed storage so initializeState() loads 'sleeping'
    global.chrome.storage.local._store.state = 'sleeping';
    global.chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/page.html' }]);
    const { handleIconClick } = await import('../action.js');
    // No explicit flush needed: storage.get stub returns Promise.resolve (already resolved),
    // so initializeState()'s await resolves as a microtask before import() returns here.
    await handleIconClick();
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ state: 'active' });
  });

  it('sends shrinkImage when toggling off on a tab with an image URL', async () => {
    global.chrome.tabs.query.mockResolvedValue([{ id: 7, url: 'https://example.com/photo.jpg' }]);
    const { handleIconClick } = await import('../action.js');
    await handleIconClick(); // active → sleeping
    expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { action: 'shrinkImage' });
  });

  it('sends enlargeImage when toggling on on a tab with an image URL', async () => {
    global.chrome.storage.local._store.state = 'sleeping';
    global.chrome.tabs.query.mockResolvedValue([{ id: 7, url: 'https://example.com/photo.jpg' }]);
    const { handleIconClick } = await import('../action.js');
    // storage.get resolves synchronously → state already 'sleeping' by the time import() returns
    await handleIconClick(); // sleeping → active
    expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { action: 'enlargeImage' });
  });

  it('does not call sendMessage when tab URL is not an image', async () => {
    global.chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/page.html' }]);
    const { handleIconClick } = await import('../action.js');
    await handleIconClick();
    expect(global.chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
});

describe('openImageInNewTab message handler', () => {
  async function getMessageHandler() {
    await import('../action.js');
    // The last registered onMessage listener is the one from action.js
    const calls = global.chrome.runtime.onMessage.addListener.mock.calls;
    return calls[calls.length - 1][0];
  }

  it('opens a new tab with the provided URL', async () => {
    const handler = await getMessageHandler();
    handler(
      { action: 'openImageInNewTab', url: 'https://example.com/photo.jpg' },
      { tab: { id: 42 } },
      vi.fn()
    );
    // tabs.create is called synchronously inside the handler — no flush needed
    expect(global.chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/photo.jpg',
    });
  });

  it('closes the sender tab after opening the new tab', async () => {
    const handler = await getMessageHandler();
    handler(
      { action: 'openImageInNewTab', url: 'https://example.com/photo.jpg' },
      { tab: { id: 42 } },
      vi.fn()
    );
    // tabs.remove is called inside tabs.create.then() — flush 1 microtask
    await Promise.resolve();
    expect(global.chrome.tabs.remove).toHaveBeenCalledWith(42);
  });

  it('responds with { success: true } after opening and closing tab', async () => {
    const handler = await getMessageHandler();
    const sendResponse = vi.fn();
    handler(
      { action: 'openImageInNewTab', url: 'https://example.com/photo.jpg' },
      { tab: { id: 42 } },
      sendResponse
    );
    // sendResponse is called inside tabs.remove.then() — flush 2 microtasks
    await Promise.resolve();
    await Promise.resolve();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('returns true to keep the message channel open for async sendResponse', async () => {
    const handler = await getMessageHandler();
    const result = handler(
      { action: 'openImageInNewTab', url: 'https://example.com/photo.jpg' },
      { tab: { id: 42 } },
      vi.fn()
    );
    expect(result).toBe(true);
  });
});
