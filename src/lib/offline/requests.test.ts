import { describe, expect, it } from 'vitest';
import { handling, replacesOldPage, shellPath, staleCache } from './requests.js';

const origin = 'https://nearhost.lab.example.dev';
const precached = new Set([
  '/_app/immutable/entry/start.abc.js',
  '/manifest.webmanifest',
  shellPath,
]);

const get = (path: string, mode: RequestMode = 'cors') => ({
  url: origin + path,
  method: 'GET',
  mode,
});

describe('handling', () => {
  it('answers the app’s navigations from the network first, with the shell to fall back on', () => {
    for (const path of [
      '/',
      '/projects/shop',
      '/approve/a1',
      '/change/shop',
      '/machine',
      '/x?y=1',
    ]) {
      expect(handling(get(path, 'navigate'), origin, precached)).toBe('shell');
    }
  });

  it('answers the build’s and the static files from the precache', () => {
    expect(handling(get('/_app/immutable/entry/start.abc.js'), origin, precached)).toBe(
      'precached',
    );
    expect(handling(get('/manifest.webmanifest'), origin, precached)).toBe('precached');
  });

  it('leaves files it did not precache to the network', () => {
    expect(handling(get('/_app/immutable/entry/other.def.js'), origin, precached)).toBe('pass');
    expect(handling(get('/icons/unknown.png'), origin, precached)).toBe('pass');
  });

  it('never touches the API, documents, pairing, auth or the core’s own paths', () => {
    for (const path of [
      '/api',
      '/api/v1/state',
      '/api/v1/events?after=3',
      '/api/v1/session',
      '/d/leto/claude-code/plan.md',
      '/d/',
      '/pair',
      '/pair/abc',
      '/pair.js',
      '/auth',
      '/profile.mobileconfig',
      '/.well-known/apple-app-site-association',
      '/.nearhost/ca.pem',
    ]) {
      for (const mode of ['navigate', 'cors', 'no-cors', 'same-origin'] as RequestMode[]) {
        expect(handling(get(path, mode), origin, precached), `${mode} ${path}`).toBe('pass');
      }
    }
  });

  it('never touches a precached path asked for under the API or documents', () => {
    const odd = new Set(['/api/v1/state', '/d/x.md']);
    expect(handling(get('/api/v1/state'), origin, odd)).toBe('pass');
    expect(handling(get('/d/x.md'), origin, odd)).toBe('pass');
  });

  it('leaves the page key’s sign-in at / to the core', () => {
    expect(handling(get('/?k=secret', 'navigate'), origin, precached)).toBe('pass');
    expect(handling(get('/?other=1&k=secret', 'navigate'), origin, precached)).toBe('pass');
  });

  it('leaves another origin alone, projects’ sites included', () => {
    expect(
      handling(
        { url: 'https://storefront.lab.example.dev/', method: 'GET', mode: 'navigate' },
        origin,
        precached,
      ),
    ).toBe('pass');
    expect(
      handling(
        { url: 'https://cdn.example.com/manifest.webmanifest', method: 'GET', mode: 'cors' },
        origin,
        precached,
      ),
    ).toBe('pass');
  });

  it('leaves anything but GET to the network', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'PATCH']) {
      expect(handling({ url: origin + '/', method, mode: 'navigate' }, origin, precached)).toBe(
        'pass',
      );
      expect(
        handling(
          { url: origin + '/manifest.webmanifest', method, mode: 'cors' },
          origin,
          precached,
        ),
      ).toBe('pass');
    }
  });

  it('matches paths, not escapes of them', () => {
    // %2F is not a slash: /api%2Fv1 is still not the app's, and an escaped /api is not a way round.
    expect(handling(get('/%61pi/v1/state'), origin, precached)).toBe('pass');
    expect(handling(get('/%61pi/v1/state', 'navigate'), origin, precached)).toBe('pass');
  });
});

describe('staleCache', () => {
  const current = 'nearhost-app-1795801949333';

  it('keeps the current cache', () => {
    expect(staleCache(current, current)).toBe(false);
  });

  it('drops an older build’s cache', () => {
    expect(staleCache('nearhost-app-1795800000000', current)).toBe(true);
  });

  it('drops the old page’s shell caches, whatever their version', () => {
    expect(staleCache('nearhost-shell-0.16.0', current)).toBe(true);
    expect(staleCache('nearhost-shell-dev', current)).toBe(true);
  });

  it('leaves caches that are not the app’s alone', () => {
    expect(staleCache('something-else', current)).toBe(false);
    expect(staleCache('nearhost-other', current)).toBe(false);
  });
});

describe('replacesOldPage', () => {
  it('is true when the worker being replaced is the old page’s /sw.js', () => {
    expect(replacesOldPage('https://nearhost.lab.example.dev/sw.js')).toBe(true);
    expect(replacesOldPage('https://nearhost.localhost/sw.js?v=0.16.0')).toBe(true);
  });

  it('is false for an earlier build of the app, which keeps waiting', () => {
    expect(replacesOldPage('https://nearhost.lab.example.dev/service-worker.js')).toBe(false);
    expect(replacesOldPage('https://nearhost.lab.example.dev/app/sw.js.map')).toBe(false);
    expect(replacesOldPage('https://nearhost.lab.example.dev/not-sw.js')).toBe(false);
  });

  it('is false when no worker is active, or the address is not one', () => {
    expect(replacesOldPage(undefined)).toBe(false);
    expect(replacesOldPage('')).toBe(false);
    expect(replacesOldPage('not a url')).toBe(false);
  });
});
