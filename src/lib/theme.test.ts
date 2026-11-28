// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyStoredAppearance,
  getAppearance,
  setAppearance,
  storageKey,
  themeColors,
} from '#lib/theme.js';

const root = () => document.documentElement;

describe('appearance', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    localStorage.clear();
    root().removeAttribute('data-theme');
    root().removeAttribute('data-theme-switching');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is system when nothing is stored', () => {
    expect(getAppearance()).toBe('system');
  });

  it('sets data-theme to light and stores it', () => {
    setAppearance('light');
    expect(root().getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(storageKey)).toBe('light');
    expect(getAppearance()).toBe('light');
  });

  it('sets data-theme to dark and stores it', () => {
    setAppearance('dark');
    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(storageKey)).toBe('dark');
  });

  it('removes the attribute and the key for system', () => {
    setAppearance('dark');
    setAppearance('system');
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(getAppearance()).toBe('system');
  });

  it('reads a stored value back, and treats anything else as system', () => {
    expect(storageKey).toBe('nearhost.appearance');
    localStorage.setItem(storageKey, 'dark');
    expect(getAppearance()).toBe('dark');
    localStorage.setItem(storageKey, 'purple');
    expect(getAppearance()).toBe('system');
  });

  it('applies the stored appearance on start', () => {
    localStorage.setItem(storageKey, 'light');
    applyStoredAppearance();
    expect(root().getAttribute('data-theme')).toBe('light');
  });

  it('suppresses transitions for one frame, then restores them', () => {
    setAppearance('light');
    expect(root().hasAttribute('data-theme-switching')).toBe(true);
    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(root().hasAttribute('data-theme-switching')).toBe(false);
  });

  it('still switches when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    setAppearance('dark');
    expect(root().getAttribute('data-theme')).toBe('dark');
    vi.restoreAllMocks();
  });
});

describe('theme-color', () => {
  const metas = () =>
    Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')).map((m) => [
      m.getAttribute('media'),
      m.getAttribute('content'),
    ]);

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    localStorage.clear();
    // As app.html has them: one for each scheme.
    document.head.innerHTML =
      '<meta name="theme-color" content="#111013" media="(prefers-color-scheme: dark)">' +
      '<meta name="theme-color" content="#f6f4f6" media="(prefers-color-scheme: light)">';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is the ground of each scheme', () => {
    expect(themeColors).toEqual({ dark: '#111013', light: '#f6f4f6' });
  });

  it('follows a light or dark override in both schemes, and each its own under system', () => {
    setAppearance('light');
    expect(metas()).toEqual([
      ['(prefers-color-scheme: dark)', '#f6f4f6'],
      ['(prefers-color-scheme: light)', '#f6f4f6'],
    ]);
    setAppearance('dark');
    expect(metas()).toEqual([
      ['(prefers-color-scheme: dark)', '#111013'],
      ['(prefers-color-scheme: light)', '#111013'],
    ]);
    setAppearance('system');
    expect(metas()).toEqual([
      ['(prefers-color-scheme: dark)', '#111013'],
      ['(prefers-color-scheme: light)', '#f6f4f6'],
    ]);
  });

  it('follows the stored appearance on start', () => {
    localStorage.setItem(storageKey, 'light');
    applyStoredAppearance();
    expect(metas().map(([, content]) => content)).toEqual(['#f6f4f6', '#f6f4f6']);
  });

  it('keeps an appearance for the session when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    setAppearance('dark');
    expect(getAppearance()).toBe('dark');
  });
});
