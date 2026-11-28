// The app's appearance setting. "system" follows prefers-color-scheme; light and dark set
// data-theme on <html>, which tokens.css lets win over the media query.

export type Appearance = 'system' | 'light' | 'dark';

export const storageKey = 'nearhost.appearance';

const switchingAttribute = 'data-theme-switching';

function isAppearance(value: unknown): value is Appearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

// Storage can throw (blocked site data, some private modes); the setting then lasts the session.
function readStored(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

// Set when storage refused the last change, so it lasts the session; cleared once storage takes one.
let remembered: Appearance | undefined;

function writeStored(appearance: Appearance) {
  try {
    if (appearance === 'system') localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, appearance);
    remembered = undefined;
  } catch {
    remembered = appearance;
  }
}

/** The browser's theme-color in each scheme: the app's ground (app.html has the same). */
export const themeColors = { dark: '#0f1210', light: '#f4f5f1' } as const;

// app.html has a theme-color meta for each scheme, keyed by its media query. Light or dark sets
// both to that scheme's colour, so the browser's bars follow the app, not the device; system gives
// each its own again.
function applyThemeColor(appearance: Appearance) {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const scheme = /dark/.test(meta.getAttribute('media') ?? '') ? 'dark' : 'light';
    meta.setAttribute('content', themeColors[appearance === 'system' ? scheme : appearance]);
  }
}

function applyAttribute(appearance: Appearance) {
  const root = document.documentElement;
  if (appearance === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', appearance);
  applyThemeColor(appearance);
}

export function getAppearance(): Appearance {
  if (remembered) return remembered;
  const stored = readStored();
  return isAppearance(stored) ? stored : 'system';
}

// Applies the stored setting without a transition guard: called once, before the app renders.
export function applyStoredAppearance() {
  applyAttribute(getAppearance());
}

export function setAppearance(appearance: Appearance) {
  const root = document.documentElement;
  // Every colour changes at once, so transitions are off for the switch (tokens.css turns them
  // off under this attribute). Reading a computed style makes the browser apply the new colours
  // with transitions still off; they come back on the next frame.
  root.setAttribute(switchingAttribute, '');
  applyAttribute(appearance);
  writeStored(appearance);
  void getComputedStyle(root).color;
  requestAnimationFrame(() => root.removeAttribute(switchingAttribute));
}
