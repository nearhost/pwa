// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyStoredAppearance, getAppearance, setAppearance, storageKey } from '#lib/theme.js';

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
