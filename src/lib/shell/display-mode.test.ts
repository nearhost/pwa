// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchDisplayMode } from '#lib/shell/display-mode.js';

type Listener = (event: { matches: boolean }) => void;

function fakeMatchMedia(initial: boolean) {
  const listeners: Listener[] = [];
  const list = {
    matches: initial,
    addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
    removeEventListener: (_type: string, listener: Listener) =>
      listeners.splice(listeners.indexOf(listener), 1),
  };
  const matchMedia = vi.fn(() => list);
  const change = (matches: boolean) => {
    list.matches = matches;
    for (const listener of [...listeners]) listener({ matches });
  };
  return { matchMedia, change, listeners };
}

const attribute = () => document.documentElement.getAttribute('data-display-mode');

describe('watchDisplayMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-display-mode');
  });

  it('marks <html> standalone when the display-mode query matches', () => {
    const fake = fakeMatchMedia(true);
    vi.stubGlobal('matchMedia', fake.matchMedia);
    const stop = watchDisplayMode();
    expect(fake.matchMedia).toHaveBeenCalledWith('(display-mode: standalone)');
    expect(attribute()).toBe('standalone');
    stop();
  });

  it('marks <html> browser otherwise, follows changes and stops listening', () => {
    const fake = fakeMatchMedia(false);
    vi.stubGlobal('matchMedia', fake.matchMedia);
    const stop = watchDisplayMode();
    expect(attribute()).toBe('browser');
    fake.change(true);
    expect(attribute()).toBe('standalone');
    stop();
    expect(fake.listeners).toHaveLength(0);
  });
});
