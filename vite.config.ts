import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

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
          'manifest-src': ['self'],
          'worker-src': ['self'],
          'base-uri': ['none'],
          'form-action': ['self'],
          'frame-ancestors': ['none'],
        },
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    expect: { requireAssertions: true },
  },
});
