// This device's settings, kept in localStorage under nearhost.*. Storage can throw (blocked site
// data, some private modes); a setting then reads as its default and a change lasts the session.

export type OpenProjectsIn = 'app' | 'browser';

const openKey = 'nearhost.openProjectsIn';
const alwaysPrefix = 'nearhost.alwaysBrowser.';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Where Preview opens a project: the app's frame (the default) or the browser. */
export function openProjectsIn(): OpenProjectsIn {
  return read(openKey) === 'browser' ? 'browser' : 'app';
}

/** Whether this device always opens project name in the browser. */
export function alwaysBrowser(name: string): boolean {
  return read(alwaysPrefix + name) === '1';
}

export function setAlwaysBrowser(name: string, on: boolean) {
  try {
    if (on) localStorage.setItem(alwaysPrefix + name, '1');
    else localStorage.removeItem(alwaysPrefix + name);
  } catch {
    // Not kept; the screen that set it still acts on it now.
  }
}
