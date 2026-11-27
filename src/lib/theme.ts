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

function writeStored(appearance: Appearance) {
  try {
    if (appearance === 'system') localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, appearance);
  } catch {
    // Not persisted; the attribute below still applies it now.
  }
}

function applyAttribute(appearance: Appearance) {
  const root = document.documentElement;
  if (appearance === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', appearance);
}

export function getAppearance(): Appearance {
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
