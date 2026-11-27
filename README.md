# Nearhost web app

The web app for [Nearhost](https://nearhost.dev): Nearhost on an iPad, a phone, or any browser, served by a Nearhost core on your network. It does what the terminal interface does, shaped for touch: your projects and their previews, agents' requests waiting for you, documents, and setting up projects and servers.

The core embeds the built app as the Go module `github.com/nearhost/pwa` and serves it from its page; this repository holds its source.

Work in progress: setup, development and release notes land here as the app takes shape.

## Developing

You need Node 22 (see `.nvmrc`) and npm.

```sh
npm ci            # install, and set up the pre-commit hook
npm run dev       # serve the app with hot reload
npm run verify    # format, lint, type check, unit and end-to-end tests, then build
```

`npm run build` writes the single-page app to `dist/`, which the core embeds. The end-to-end tests run in Chromium and WebKit; install them once with `npx playwright install chromium webkit`.

## License

MIT
