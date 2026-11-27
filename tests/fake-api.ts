// The fake core the end-to-end tests run the app against. Each page gets its own: Playwright's
// route mocks answer the HTTP API (/api/v1/session, /api/v1/state and any route a test adds), and
// an init script puts a stand-in EventSource on the page, which the test drives from Node: open
// the stream, send envelopes and heartbeats, drop it. Nothing is shared between tests, so they run
// in parallel and in any browser. See the README's "End-to-end tests and the fake API".
import type { Page, Request } from '@playwright/test';
import { session as makeSession, state as makeState } from '../src/lib/api/testing.js';
import type { Envelope, Session, State } from '../src/lib/api/types.js';

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
  /** Open the event stream as soon as the app connects (the default), or leave it to the test. */
  open?: boolean;
}

export interface FakeApi {
  /** The state GET /api/v1/state answers with now. */
  state: State;
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
}

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
    state: makeState(1, opts.state),
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
      for (const e of envelopes) {
        api.state.seq = e.kind === 'reset' ? e.seq : Math.max(api.state.seq, e.seq);
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
  };
  const session = makeSession(opts.session);

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
    if (opts.signedOut) {
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
    if (fake.method === 'GET' && url.pathname === '/api/v1/state') return json(200, api.state);
    return json(404, {
      error: 'Not found',
      title: `The fake API has no route for ${fake.method} ${url.pathname}`,
      status: 404,
      code: 'control.not-found',
    });
  });

  return api;
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
