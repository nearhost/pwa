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

### End-to-end tests and the fake API

The Playwright tests in `tests/` run the built app (`vite preview`) against a fake core of their own, `tests/fake-api.ts`, one per page, so tests share nothing and run in parallel in both browsers:

- **HTTP** is answered by Playwright route mocks on `**/api/**`: `GET /api/v1/session` and `GET /api/v1/state` answer by default (the state is `api.state`, a test may change it before the app reads it again), `api.on('POST /api/v1/projects/shop/start', handler)` answers any other request, and anything else gets a 404 problem (`control.not-found`) that names the route. As the core's gate does, a write (any method but GET and HEAD) without the session's `X-Nearhost-CSRF` token or without `Content-Type: application/json` gets a 403 `proxy.api-write-refused`. `api.requests` records every request with its parsed body. `fakeApi(page, { signedOut: true })` answers 401 everywhere.
- **The event stream** is a stand-in `EventSource` an init script puts on the page before the app loads. It opens on its own unless the test passes `open: false` (then `await api.open()`); `api.send(envelope(6, { kind: 'config' }))`, `api.heartbeat()` and `api.drop()` drive it from the test. `api.send` moves `api.state.seq` up to the envelopes it sends (a reset sets it), as the core's state seq follows its stream, so a state the app reads afterwards never leaves a gap behind it.

```ts
import { envelope, fakeApi } from './fake-api.js';

test('a project starts', async ({ page }) => {
  const api = await fakeApi(page, { state: { projects: { shop } } }); // shop: a stopped ProjectStatus
  api.on('POST /api/v1/projects/shop/start', () => ({ status: 204 }));
  await page.goto('/');
  // ...
  await api.send(
    envelope(2, {
      event: { Time: '', Project: 'shop', Server: '', State: 'running', Message: 'state: running' },
    }),
  );
});
```

The states and sessions come from the same builders as the unit tests' (`src/lib/api/testing.ts`); `fakeApi` copies the state it is given, so a test that changes `api.state` never changes a shared fixture. `tests/fixtures.ts` has the canvas's projects (`canvas`: storefront with three routes, docs-site and a stopped admin on leto; api and a starting worker on the server build-box), and `serveSites(page, { hang })` answers the projects' own addresses (`https://*.lab.example.dev`) in the preview's frame with a small page, except the hosts in `hang`, which never answer. The preview's 8 s load timeout is driven with Playwright's clock (`page.clock.install()`, then `page.clock.fastForward(8_000)` once the frame is there). Journeys run at the canvas's three sizes (`tests/sizes.ts`) in both colour schemes. Locally, run Chromium with `npx playwright test --project=chromium --workers=2`; WebKit runs on a Mac.

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

Releases and betas need no tags pushed by hand; [release-please](https://github.com/googleapis/release-please) makes them from the conventional commits on `main`:

- **A release.** release-please keeps a release PR open on `main` that bumps `package.json`, `package-lock.json` and `.release-please-manifest.json` and writes `CHANGELOG.md`. Merge it to release that version, X.Y.Z: release-please tags the merge commit `build/vX.Y.Z` and publishes its GitHub release.
- **A beta.** Every push to the release PR's branch (`release-please--branches--main--components--build`) publishes the next beta of its version, X.Y.Z-beta.N, as the GitHub prerelease `build/vX.Y.Z-beta.N` (the `beta` workflow). Running `beta` by hand on that branch publishes another.

Each published release of a `build/v` tag starts the `release` workflow, which:

1. checks the tag out, runs `npm ci && npm run build`, writes `version.go` and runs `go test -tags release`,
2. commits `dist/` and `version.go` as "release vVERSION" on a detached HEAD (it is not on `main`),
3. pushes only the tag `vVERSION`, which is the Go module version, and
4. adds `go get github.com/nearhost/pwa@vVERSION` to the release's notes.

A beta's module version, `vX.Y.Z-beta.N`, is a Go prerelease: `go get github.com/nearhost/pwa@latest` passes over it, so the core takes a beta only by naming it. The beta's GitHub release stays a prerelease.

Run the `release` workflow by hand (Actions, release) with a `build/v` tag and `dry_run` on to build and test without pushing a tag; with `dry_run` off it releases a tag whose GitHub release exists, when the run the release started failed. Locally, `scripts/release.sh VERSION --dry-run` (X.Y.Z or X.Y.Z-beta.N) in a clean clone does the same, prints the commit and tag it would push, then deletes the tag and returns to where it started. Without `--dry-run` the script refuses unless `build/vVERSION` exists, HEAD is that tag's commit, and that commit is on `origin/main` (a release) or on the release PR's branch (a beta), so a GitHub release made by hand on another commit publishes nothing. If `vVERSION` is already on the release commit built from that tag, as when a rerun follows a failed notes step, it says so and exits without building. `scripts/release_test.sh` checks these guards, and `.github/scripts/beta-version_test.sh` the beta numbering; CI runs both.

### One-time setup

release-please and `beta` act with the token of the CI GitHub App the core repository uses (nearhost-ci), because a release or PR made with the workflows' own `GITHUB_TOKEN` starts no other workflow. The app must be installed on this repository with read and write access to contents and pull requests, and the repository (or the organisation) needs:

- the variable `NH_APP_CLIENT_ID`, the app's client ID, and
- the secret `NH_APP_PRIVATE_KEY`, a private key of the app.

The core picks a release up with `go get github.com/nearhost/pwa@vX.Y.Z` and serves `pwa.FS()` when `pwa.Built()` is true.

## License

MIT
