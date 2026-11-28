// Which requests the service worker may answer, and how. It keeps the app's shell and nothing
// else: the build's files and the static ones, precached, and index.html, the shell every route of
// the app loads from. It never answers for the core: the API, documents, pairing, sign-in and the
// core's own paths go to the network as if there were no worker, and so does anything on another
// origin (a project's site in the preview's frame) and anything but a GET.

/** The shell: the core answers every route of the app with it, and so does the worker offline. */
export const shellPath = '/index.html';

/**
 * - `shell`: a navigation of the app. The network first; the cached shell when it doesn't answer.
 * - `precached`: one of the build's or the static files. The cache first.
 * - `pass`: not the worker's. It doesn't answer, and the browser goes to the network.
 */
export type Handling = 'shell' | 'precached' | 'pass';

export interface RequestLike {
  url: string;
  method: string;
  mode: RequestMode;
}

// The core's own paths, as its appServerPath has them: whatever answers there is never the app.
const serverPrefixes = ['/api', '/pair'];
const serverPaths = ['/pair.js', '/auth', '/profile.mobileconfig'];
const serverTrees = ['/d/', '/.well-known/', '/.nearhost/'];

/** Whether pathname (decoded) is the core's own and never the app's. */
export function serverPath(pathname: string): boolean {
  if (serverPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (serverPaths.includes(pathname)) return true;
  return serverTrees.some((p) => pathname.startsWith(p));
}

/**
 * How the worker handles request, made on origin (the worker's own), given the paths it
 * precached.
 */
export function handling(request: RequestLike, origin: string, precached: Set<string>): Handling {
  if (request.method !== 'GET') return 'pass';
  const url = new URL(request.url);
  if (url.origin !== origin) return 'pass';
  let pathname: string;
  try {
    // An escaped path is the same path: /%61pi is still the API's.
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return 'pass';
  }
  if (serverPath(pathname) || serverPath(url.pathname)) return 'pass';
  // The page key's sign-in, /?k=…: the core sets its cookie and redirects.
  if (url.pathname === '/' && url.searchParams.has('k')) return 'pass';
  if (request.mode === 'navigate') return 'shell';
  return precached.has(url.pathname) ? 'precached' : 'pass';
}

/** The app's caches: one per build, named for its version. */
export const cachePrefix = 'nearhost-app-';
// The old page's worker (the core's /sw.js) kept its shell in nearhost-shell-<version>.
const oldPagePrefix = 'nearhost-shell-';

/** Whether the cache name is one to delete once the worker with current is active. */
export function staleCache(name: string, current: string): boolean {
  if (name === current) return false;
  return name.startsWith(cachePrefix) || name.startsWith(oldPagePrefix);
}
