import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import type { ProxyOptions } from 'vite';
import { defineConfig } from 'vitest/config';

// `npm run dev` against a running core (see the README): NEARHOST_CORE is the core's page, such as
// https://nearhost.localhost:9444, and /api goes there. The gate takes a write only from the
// page's own origin, so the proxy sends the core's. The page cookie is Secure and host-only, so a
// browser on the dev server never has it; with NEARHOST_PAGE_SECRET_FILE (the core's page-secret
// file) the proxy adds it. Development only: anyone who can reach the dev server is signed in.
// The app's own version, shown on This machine beside the core's.
const appVersion = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

function coreProxy(): Record<string, ProxyOptions> | undefined {
  const core = process.env.NEARHOST_CORE;
  if (!core) return undefined;
  const origin = new URL(core).origin;
  const secretFile = process.env.NEARHOST_PAGE_SECRET_FILE;
  const cookie = secretFile ? `__Host-nearhost=${readFileSync(secretFile, 'utf8').trim()}` : '';
  return {
    '/api': {
      target: origin,
      changeOrigin: true,
      // The scratch core's certificate is from its own local CA, which Node does not trust.
      secure: false,
      configure(proxy) {
        proxy.on('proxyReq', (req) => {
          if (req.getHeader('origin')) req.setHeader('origin', origin);
          if (cookie) req.setHeader('cookie', cookie);
        });
        // Node holds a response's headers until its first byte, so an idle event stream would
        // not open for up to 15 s (the core's keep-alive). Send them as soon as they are written.
        proxy.on('proxyRes', (proxyRes, _req, res) => {
          if (proxyRes.headers['content-type']?.startsWith('text/event-stream')) {
            setImmediate(() => {
              if ('flushHeaders' in res && !res.headersSent) res.flushHeaders();
            });
          }
        });
      },
    },
  };
}

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Runes everywhere except in dependencies.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      // A single-page app: every route falls back to index.html, which the core serves for any
      // path that is not an asset or one of its own.
      adapter: adapter({
        pages: 'dist',
        assets: 'dist',
        fallback: 'index.html',
        precompress: false,
      }),
      // The policy the core sends with the app. SvelteKit hashes its own inline bootstrap script
      // into script-src; styles keep 'unsafe-inline', so no style hashes are added.
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['none'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          // The preview's frame shows the projects' own sites, which are only ever https. The core's
          // header names the projects' hosts; the build can't know them. The reader's frame shows
          // documents from the page's own origin, at /d/.
          'frame-src': ['self', 'https:'],
          'manifest-src': ['self'],
          'worker-src': ['self'],
          'base-uri': ['none'],
          'form-action': ['self'],
          'frame-ancestors': ['none'],
        },
      },
    }),
  ],
  define: { __NEARHOST_APP_VERSION__: JSON.stringify(appVersion) },
  server: { proxy: coreProxy() },
  // vite preview takes server.proxy unless told otherwise; it must never add the page cookie.
  preview: { proxy: {} },
  build: {
    // Fonts are always files: the CSP's font-src is 'self' only, so a data: URI would be refused.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    expect: { requireAssertions: true },
  },
});
