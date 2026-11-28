// The fake core the end-to-end tests run the app against. Each page gets its own: Playwright's
// route mocks answer the HTTP API (/api/v1/session, /api/v1/state and any route a test adds), and
// an init script puts a stand-in EventSource on the page, which the test drives from Node: open
// the stream, send envelopes and heartbeats, drop it. Nothing is shared between tests, so they run
// in parallel and in any browser. See the README's "End-to-end tests and the fake API".
import { readFileSync } from 'node:fs';
import type { Page, Request } from '@playwright/test';
import { session as makeSession, state as makeState } from '../src/lib/api/testing.js';
import type {
  DeviceInfo,
  Envelope,
  NetworkInfo,
  Session,
  State,
  Status,
} from '../src/lib/api/types.js';

export { envelope } from '../src/lib/api/testing.js';

export interface FakeRequest {
  method: string;
  path: string;
  body: unknown;
}

type Answer = { status?: number; body?: unknown };
type Handler = (request: FakeRequest) => Answer | Promise<Answer>;

export interface FakeApiOptions {
  /** Merged over a state with nothing in it at seq 1. */
  state?: Partial<State>;
  /** Merged over a session for the machine leto. */
  session?: Partial<Session>;
  /** Answer every API request with 401, as for a browser that is not paired. */
  signedOut?: boolean;
  /** The paired devices; by default this device (the session's) and a phone. */
  devices?: DeviceInfo[];
  /**
   * How the core serves the network, merged over serving at nearhost.lab.example.dev with Let's
   * Encrypt's certificates; null for a core that does not.
   */
  network?: Partial<NetworkInfo> | null;
  /** Open the event stream as soon as the app connects (the default), or leave it to the test. */
  open?: boolean;
  /**
   * Answer the state as the core does on a networked machine: a route's networkUrl only while its
   * project runs (running or degraded), so a project started after a read has none until the next.
   */
  networkWhileRunning?: boolean;
}

export interface FakeApi {
  /** The state GET /api/v1/state answers with now. */
  state: State;
  /** The devices GET /api/v1/devices answers with now; DELETE takes one out. */
  devices: DeviceInfo[];
  /** Whether every API request is answered 401 now: set by the option, or by unpairing this device. */
  signedOut: boolean;
  /** Every API request the app made, oldest first. */
  requests: FakeRequest[];
  /** Answers `METHOD /api/v1/...` with handler; it takes precedence over the defaults. */
  on(key: string, handler: Handler): void;
  /** Waits for the app to open the stream, and opens it if the test chose to. */
  open(): Promise<void>;
  /** Sends envelopes on the open stream, in order. */
  send(...envelopes: Envelope[]): Promise<void>;
  heartbeat(): Promise<void>;
  /** Drops the stream, as a network that goes away does. */
  drop(): Promise<void>;
  /** How many streams the app has opened. */
  streams(): Promise<number>;
  /**
   * The documents served below /d/, by path without the query, as the core serves them: a Markdown
   * body in the core's page around it, or an HTML document as it is. See serveDocument.
   */
  documents: Record<string, FakeDocument>;
  /** Every request below /d/, path and query, oldest first. */
  documentRequests: string[];
}

export type FakeDocument = { markdown: string; title: string } | { html: string };

declare global {
  interface Window {
    __nearhostFakeEvents?: {
      instances: {
        url: string;
        closed: boolean;
        open(): void;
        message(data: string): void;
        named(type: string, data: string): void;
        error(): void;
      }[];
      autoOpen: boolean;
    };
  }
}

export async function fakeApi(page: Page, opts: FakeApiOptions = {}): Promise<FakeApi> {
  const handlers = new Map<string, Handler>();
  const requests: FakeRequest[] = [];
  const api: FakeApi = {
    // A copy, so a test that changes its state never changes a fixture another test shares.
    state: makeState(1, structuredClone(opts.state)),
    devices: [],
    signedOut: opts.signedOut ?? false,
    requests,
    on: (key, handler) => void handlers.set(key, handler),
    async open() {
      await page.waitForFunction(() => {
        const last = window.__nearhostFakeEvents?.instances.at(-1);
        return !!last && !last.closed;
      });
      await page.evaluate(() => window.__nearhostFakeEvents!.instances.at(-1)!.open());
    },
    async send(...envelopes) {
      // As the core's: the state is as new as everything sent (a reset starts the numbers again),
      // so a read the app makes after these never leaves a gap behind it.
      // A project's state change is in the state from then on, as the core's.
      for (const e of envelopes) {
        api.state.seq = e.kind === 'reset' ? e.seq : Math.max(api.state.seq, e.seq);
        const change = e.kind === 'event' ? e.event : undefined;
        const project = change?.Project ? api.state.projects?.[change.Project] : undefined;
        if (change?.State && project) {
          project.State = change.State;
          const prefix = `state: ${change.State}: `;
          project.Message = change.Message.startsWith(prefix)
            ? change.Message.slice(prefix.length)
            : '';
        }
      }
      await page.evaluate((all) => {
        const last = window.__nearhostFakeEvents!.instances.at(-1)!;
        for (const e of all) last.message(JSON.stringify(e));
      }, envelopes);
    },
    async heartbeat() {
      await page.evaluate(() =>
        window.__nearhostFakeEvents!.instances.at(-1)!.named('heartbeat', '{}'),
      );
    },
    async drop() {
      await page.evaluate(() => window.__nearhostFakeEvents!.instances.at(-1)!.error());
    },
    streams: () => page.evaluate(() => window.__nearhostFakeEvents?.instances.length ?? 0),
    documents: {},
    documentRequests: [],
  };
  const session = makeSession(opts.session);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  api.devices = structuredClone(
    opts.devices ?? [
      ...(session.device
        ? [
            {
              name: session.device,
              paired: new Date(now - day).toISOString(),
              last_seen: new Date(now).toISOString(),
              last_addr: '192.168.77.20:51234',
            },
          ]
        : []),
      {
        name: 'Phone',
        paired: new Date(now - 7 * day).toISOString(),
        last_seen: new Date(now - 3 * day).toISOString(),
        last_addr: '192.168.77.21:50410',
      },
    ],
  );
  const network: NetworkInfo | undefined =
    opts.network === null
      ? undefined
      : {
          on: true,
          listening: true,
          url: 'https://nearhost.lab.example.dev',
          certificates: 'acme',
          ...opts.network,
        };

  await page.addInitScript((autoOpen: boolean) => {
    type Listener = (event: MessageEvent) => void;
    class FakeEventSource {
      url: string;
      closed = false;
      readyState = 0;
      onopen: ((event: Event) => void) | null = null;
      onmessage: Listener | null = null;
      onerror: ((event: Event) => void) | null = null;
      private listeners = new Map<string, Listener[]>();

      constructor(url: string | URL) {
        this.url = String(url);
        state.instances.push(this);
        if (state.autoOpen) setTimeout(() => this.open(), 0);
      }
      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }
      removeEventListener(type: string, listener: Listener) {
        this.listeners.set(
          type,
          (this.listeners.get(type) ?? []).filter((l) => l !== listener),
        );
      }
      close() {
        this.closed = true;
        this.readyState = 2;
      }
      open() {
        if (this.closed) return;
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }
      message(data: string) {
        if (!this.closed) this.onmessage?.(new MessageEvent('message', { data }));
      }
      named(type: string, data: string) {
        if (this.closed) return;
        for (const l of this.listeners.get(type) ?? []) l(new MessageEvent(type, { data }));
      }
      error() {
        if (!this.closed) this.onerror?.(new Event('error'));
      }
    }
    const state = { instances: [] as FakeEventSource[], autoOpen };
    window.__nearhostFakeEvents = state;
    Object.defineProperty(window, 'EventSource', { value: FakeEventSource, configurable: true });
  }, opts.open ?? true);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const fake: FakeRequest = {
      method: request.method(),
      path: url.pathname + url.search,
      body: parseBody(request),
    };
    requests.push(fake);
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        body: body === undefined ? '' : JSON.stringify(body),
      });
    if (api.signedOut) {
      return json(401, {
        error: 'Sign in',
        title: 'Sign in',
        status: 401,
        code: 'proxy.api-sign-in',
      });
    }
    // The core's gate: a write needs the session's token and says it is JSON, body or not.
    if (fake.method !== 'GET' && fake.method !== 'HEAD') {
      const headers = request.headers();
      if (
        headers['x-nearhost-csrf'] !== session.csrf ||
        !headers['content-type']?.startsWith('application/json')
      ) {
        return json(403, {
          error: 'Write refused',
          title: 'Write refused',
          status: 403,
          code: 'proxy.api-write-refused',
        });
      }
    }
    const handler = handlers.get(`${fake.method} ${url.pathname}`);
    if (handler) {
      const answer = await handler(fake);
      return json(answer.status ?? 200, answer.body);
    }
    if (fake.method === 'GET' && url.pathname === '/api/v1/session') return json(200, session);
    if (fake.method === 'GET' && url.pathname === '/api/v1/state') {
      return json(200, opts.networkWhileRunning ? servedState(api.state) : api.state);
    }
    if (fake.method === 'GET' && url.pathname === '/api/v1/status') {
      const status: Status = {
        info: {
          api: 1,
          version: '0.17.0',
          pid: 4242,
          started: new Date(now - day).toISOString(),
          startedBy: 'service',
          reloads: true,
          ...(api.state.info as Partial<Status['info']>),
        },
        servers: null,
        projects: null,
        approvals: null,
        page: network?.url || 'https://nearhost.localhost',
        network,
      };
      return json(200, status);
    }
    // As the core's: devices are listed and unpaired only while it serves the network.
    if (url.pathname === '/api/v1/devices' || url.pathname.startsWith('/api/v1/devices/')) {
      if (!network?.on) {
        return json(409, {
          error: 'Not networked',
          title: 'This machine does not serve the network',
          status: 409,
          code: 'network.off',
        });
      }
      if (fake.method === 'GET' && url.pathname === '/api/v1/devices') {
        return json(200, api.devices);
      }
      const name = decodeURIComponent(url.pathname.slice('/api/v1/devices/'.length));
      if (fake.method === 'DELETE' && name && !name.includes('/')) {
        if (!api.devices.some((d) => d.name === name)) {
          return json(404, {
            error: 'Unknown device',
            title: `No paired device is called ${name}`,
            status: 404,
            code: 'device.unknown',
          });
        }
        api.devices = api.devices.filter((d) => d.name !== name);
        // This device's credential is gone with it: from now on the core answers 401.
        if (name === session.device) api.signedOut = true;
        return json(204, undefined);
      }
    }
    return json(404, {
      error: 'Not found',
      title: `The fake API has no route for ${fake.method} ${url.pathname}`,
      status: 404,
      code: 'control.not-found',
    });
  });

  await page.route(/^https?:\/\/localhost(:\d+)?\/d\//, (route) => {
    const url = new URL(route.request().url());
    api.documentRequests.push(url.pathname + url.search);
    return route.fulfill(serveDocument(api.documents[url.pathname], url.searchParams));
  });

  return api;
}

// The app's document stylesheet, which the core inlines into a themed document.
const documentsCSS = readFileSync(new URL('../static/documents.css', import.meta.url), 'utf8');

// The core's policies for documents (internal/documents/serve.go and theme.go).
const csp = {
  markdown:
    "sandbox allow-popups; default-src 'none'; base-uri 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:",
  html: 'sandbox allow-scripts allow-popups allow-forms',
  themedHTML: "sandbox allow-popups allow-forms; script-src 'none'",
};

/**
 * Answers a /d/ request as the core does: ?theme=paper or app (with scheme=light or dark) marks
 * <html> with data-nh-theme (and data-nh-scheme) and inlines documents.css first in <head>; any
 * other theme is the document as written. A Markdown document is the core's page: the title, a
 * home link and the body in <article>. A path not in documents is the core's 404.
 */
export function serveDocument(doc: FakeDocument | undefined, query: URLSearchParams) {
  if (!doc) {
    return {
      status: 404,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>Not found</title><h1>This document isn’t served</h1>',
    };
  }
  const name = query.get('theme');
  const theme = name === 'paper' || name === 'app' ? name : undefined;
  const scheme = query.get('scheme');
  let attrs = '';
  if (theme) {
    attrs = ` data-nh-theme="${theme}"`;
    if (scheme === 'light' || scheme === 'dark') attrs += ` data-nh-scheme="${scheme}"`;
  }
  const style = theme ? `<style>\n${documentsCSS}</style>\n` : '';
  if ('markdown' in doc) {
    return {
      status: 200,
      contentType: 'text/html; charset=utf-8',
      headers: { 'Content-Security-Policy': csp.markdown },
      body:
        `<!doctype html>\n<html lang="en"${attrs}>\n<head>\n<meta charset="utf-8">\n` +
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        `<meta name="color-scheme" content="light dark">\n<title>${doc.title}</title>\n` +
        `${style || '<style>body{font-family:serif}</style>\n'}</head>\n<body>\n` +
        `<a class="home" href="/">Nearhost</a>\n<article>\n${doc.markdown}</article>\n</body>\n</html>\n`,
    };
  }
  const body = theme
    ? doc.html.replace(/<html([^>]*)>/i, `<html$1${attrs}>`).replace(/<head>/i, `<head>${style}`)
    : doc.html;
  return {
    status: 200,
    contentType: 'text/html; charset=utf-8',
    headers: { 'Content-Security-Policy': theme ? csp.themedHTML : csp.html },
    body,
  };
}

// The state with a route's networkUrl only where its project runs, as a networked core gives it.
function servedState(state: State): State {
  const copy = structuredClone(state);
  for (const [name, site] of Object.entries(copy.sites ?? {})) {
    const running = ['running', 'degraded'].includes(copy.projects?.[name]?.State ?? '');
    if (running) continue;
    for (const route of site.routes ?? []) delete route.networkUrl;
  }
  return copy;
}

function parseBody(request: Request): unknown {
  const text = request.postData();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
