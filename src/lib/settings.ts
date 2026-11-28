// This device's settings, kept in localStorage under nearhost.*. Storage can throw (blocked site
// data, some private modes); a setting then reads as its default, and a change made here is kept
// in memory, so it lasts the session.

export type OpenProjectsIn = 'app' | 'browser';

const openKey = 'nearhost.openProjectsIn';
const alwaysPrefix = 'nearhost.alwaysBrowser.';

// What this session set, which storage may not have kept.
const remembered: Record<string, boolean> = {};

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
  return remembered[name] ?? read(alwaysPrefix + name) === '1';
}

export function setAlwaysBrowser(name: string, on: boolean) {
  remembered[name] = on;
  try {
    if (on) localStorage.setItem(alwaysPrefix + name, '1');
    else localStorage.removeItem(alwaysPrefix + name);
  } catch {
    // Not kept in storage; remembered above for this session.
  }
}

/** How the reader shows a document: on paper, in the app's colours, or as the agent wrote it. */
export type DocumentsTheme = 'paper' | 'app' | 'written';

const themeKey = 'nearhost.documentsTheme';
let rememberedTheme: DocumentsTheme | undefined;

function isDocumentsTheme(value: unknown): value is DocumentsTheme {
  return value === 'paper' || value === 'app' || value === 'written';
}

/** The reader's theme on this device: paper unless set. */
export function documentsTheme(): DocumentsTheme {
  if (rememberedTheme) return rememberedTheme;
  const stored = read(themeKey);
  return isDocumentsTheme(stored) ? stored : 'paper';
}

export function setDocumentsTheme(theme: DocumentsTheme) {
  rememberedTheme = theme;
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    // Not kept in storage; remembered above for this session.
  }
}
