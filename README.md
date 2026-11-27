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

The app talks to the core only through `src/lib/api/`, with the types from [`@nearhost/api`](https://www.npmjs.com/package/@nearhost/api), pinned to the version of the core it is built for. `src/lib/api/types.ts` is the one file that imports them.

### Developing against a running core

The app calls the core's API at `/api` on its own origin. The dev server proxies `/api` to a core when `NEARHOST_CORE` names the core's page. Two things stand in the way of a browser on the dev server, and the proxy handles both:

- **The page cookie.** The core lets the API in with its page cookie, `__Host-nearhost`, which is Secure and host-only at `nearhost.localhost`. A browser on `http://localhost:5173` never has it. With `NEARHOST_PAGE_SECRET_FILE` set to the core's `page-secret` file, the proxy adds the cookie to every `/api` request. Without it, the app shows "Not paired", which is how you check that screen.
- **The origin.** The core takes a write only when `Origin` is exactly its page's own, so the proxy sends the core's origin in place of the dev server's.

Run a scratch core, so your own Nearhost and its config are untouched. From a checkout of [nearhost/nearhost](https://github.com/nearhost/nearhost):

```sh
go build -o ~/.nht/nearhost-dev ./cmd/nearhost
mkdir -p ~/.nht/nh-dev/{home,config,data,state}
HOME=~/.nht/nh-dev/home XDG_CONFIG_HOME=~/.nht/nh-dev/config \
  XDG_DATA_HOME=~/.nht/nh-dev/data XDG_STATE_HOME=~/.nht/nh-dev/state \
  ~/.nht/nearhost-dev daemon --no-hosts --https-port 9443 --http-port 9080 --web-port 9444
```

The core keeps its page secret in `~/.nht/nh-dev/data/nearhost/page-secret` and logs to `~/.nht/nh-dev/config/nearhost/core.log`. Then, in this repository:

```sh
NEARHOST_CORE=https://nearhost.localhost:9444 \
NEARHOST_PAGE_SECRET_FILE=~/.nht/nh-dev/data/nearhost/page-secret \
  npm run dev
```

and open `http://localhost:5173`. The header shows the machine and "Live". Stop the core and it shows "Can't reach this machine", and "Live" again soon after the core is back. To check from a terminal:

```sh
curl http://localhost:5173/api/v1/session          # 200, with the csrf token
curl http://localhost:5173/api/v1/state            # 200, the state and its seq
curl -N 'http://localhost:5173/api/v1/events?after=0'   # the stream, one data: line per envelope
```

The proxy signs in anyone who can reach the dev server, so keep it on `localhost` (no `--host`) and use it only with a scratch core. The proxy does not verify the scratch core's certificate, which comes from its own local CA.

## Releases and the Go module

This repository is also the Go module `github.com/nearhost/pwa`. `package pwa` has `FS() fs.FS` (the built app), `Built() bool` (true when `dist/index.html` is present) and `const Version`. On `main` `dist/` holds only `.gitkeep`, so `Built()` is false and `Version` is `"dev"`.

To release version X.Y.Z, push the tag `build/vX.Y.Z` on the commit to build (a person or Claude). The `release` workflow then:

1. checks that commit out, runs `npm ci && npm run build`, writes `version.go` and runs `go test -tags release`,
2. commits `dist/` and `version.go` as "release vX.Y.Z" on no branch (it is not on `main`),
3. pushes only the tag `vX.Y.Z`, which is the Go module version, and
4. creates the GitHub release `vX.Y.Z`.

Run the workflow by hand (Actions, release) with `dry_run` on to build and test without pushing a tag. Locally, `scripts/release.sh X.Y.Z --dry-run` in a clean clone does the same and prints the commit and tag it would push.

The core picks a release up with `go get github.com/nearhost/pwa@vX.Y.Z` and serves `pwa.FS()` when `pwa.Built()` is true.

## License

MIT
