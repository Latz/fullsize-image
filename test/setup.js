import { vi } from 'vitest';

// jsdom does not implement requestAnimationFrame — execute callback synchronously
global.requestAnimationFrame = vi.fn(cb => cb());

global.chrome = {
  storage: {
    local: {
      _store: {},
      get: vi.fn(function (keys, cb) {
        const result = {};
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => {
          if (global.chrome.storage.local._store[k] !== undefined) {
            result[k] = global.chrome.storage.local._store[k];
          }
        });
        if (cb) cb(result);
        return Promise.resolve(result);
      }),
      set: vi.fn(function (obj, cb) {
        Object.assign(global.chrome.storage.local._store, obj);
        if (cb) cb();
        return Promise.resolve();
      }),
      onChanged: { addListener: vi.fn() },
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
  },
  action: {
    setIcon: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
    onClicked: { addListener: vi.fn() },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com/photo.jpg' }]),
    create: vi.fn().mockResolvedValue({ id: 99 }),
    remove: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
};
