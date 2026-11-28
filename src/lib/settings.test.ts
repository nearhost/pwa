import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alwaysBrowser, openProjectsIn, setAlwaysBrowser } from './settings.js';

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('device settings', () => {
  it('opens projects in the app unless the device says the browser', () => {
    expect(openProjectsIn()).toBe('app');
    store.set('nearhost.openProjectsIn', 'browser');
    expect(openProjectsIn()).toBe('browser');
    store.set('nearhost.openProjectsIn', 'nonsense');
    expect(openProjectsIn()).toBe('app');
  });

  it('keeps "always open in the browser" per project, as 1 when set', () => {
    expect(alwaysBrowser('shop')).toBe(false);
    setAlwaysBrowser('shop', true);
    expect(store.get('nearhost.alwaysBrowser.shop')).toBe('1');
    expect(alwaysBrowser('shop')).toBe(true);
    expect(alwaysBrowser('blog')).toBe(false);
    setAlwaysBrowser('shop', false);
    expect(store.has('nearhost.alwaysBrowser.shop')).toBe(false);
  });

  it('reads as the defaults when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(openProjectsIn()).toBe('app');
    expect(alwaysBrowser('shop')).toBe(false);
    expect(() => setAlwaysBrowser('shop', true)).not.toThrow();
    // Kept for the session instead.
    expect(alwaysBrowser('shop')).toBe(true);
    setAlwaysBrowser('shop', false);
    expect(alwaysBrowser('shop')).toBe(false);
  });
});
