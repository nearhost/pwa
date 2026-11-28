// The app's service worker: it keeps the shell, so the app opens without a network and says it
// can't reach the machine, never a browser's error page. It precaches the build's files, the
// static ones and index.html, and nothing else; it never answers for the core (the API, documents,
// pairing, sign-in), never keeps what the core says and leaves other origins alone. See
// #lib/offline/requests.ts for which request is whose.
//
// Navigations go to the network first: the core always serves the app it has now. Only when the
// network gives no answer, or none within 4 s (a VPN with no route swallows requests rather than
// failing them), is the cached index.html served.
//
// Updates: each build is a new worker (its file list and version are in it) with its own cache,
// nearhost-app-<version>. Over an earlier build's worker it does not skip waiting: a page that is
// open keeps the worker, and the cache, it loaded with, so its own route chunks still load from
// that cache offline after the core was updated. The new worker takes over once no page uses the old one (the app closed and opened
// again), and only then deletes the old caches, the old page's nearhost-shell-* among them. Its
// first install claims the open page, which no worker controlled, so that page's chunks are served
// offline too. Over the old page's worker (the core's /sw.js), which has no chunks to protect, it
// skips waiting and takes over at once, so a device that had the old page moves to the app's.
import { self } from '$app/service-worker';
import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';
import {
  cachePrefix,
  handling,
  replacesOldPage,
  shellPath,
  staleCache,
} from '#lib/offline/requests.js';

const cacheName = cachePrefix + version;
const navigationTimeout = 4000;

// The manifest's paths are relative to the app's base, where this worker is.
const precached = new Set(
  [shellPath, ...[...immutable, ...assets].map((file) => file.path)].map(
    (path) => new URL(path, self.location.href).pathname,
  ),
);

self.addEventListener('install', (event) => {
  // The old page's worker has no chunks of an open page to keep: take over from it at once.
  if (replacesOldPage(self.registration.active?.scriptURL)) void self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      // Past the browser's HTTP cache, so the files are this build's.
      await cache.addAll([...precached].map((path) => new Request(path, { cache: 'reload' })));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (staleCache(name, cacheName)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  switch (handling(request, self.location.origin, precached)) {
    case 'shell':
      event.respondWith(navigate(request));
      return;
    case 'precached':
      event.respondWith(precachedFile(request));
      return;
    case 'pass':
      return;
  }
});

async function navigate(request: Request): Promise<Response> {
  // A navigation the network hasn't answered in time is given up, not left to run on.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('No answer in time', 'TimeoutError')),
    navigationTimeout,
  );
  try {
    return await fetch(request, { signal: controller.signal });
  } catch {
    const shell = await caches.match(shellPath, { cacheName });
    return (
      shell ??
      new Response("Can't reach Nearhost", {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  } finally {
    clearTimeout(timer);
  }
}

async function precachedFile(request: Request): Promise<Response> {
  const cached = await caches.match(new URL(request.url).pathname, { cacheName });
  return cached ?? fetch(request);
}
