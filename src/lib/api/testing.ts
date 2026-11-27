// Fakes for the API's tests: a fetch that answers from a table of routes and records every
// request, and an EventSource the test drives by hand.
import type { Envelope, Problem, Session, State } from './types.js';

export interface Call {
  method: string;
  path: string;
  headers: Headers;
  body: string | undefined;
}

type Route = (call: Call) => Response | Promise<Response>;

export interface FakeFetch {
  fetch: typeof fetch;
  calls: Call[];
  /** Answers `METHOD /path` (the path as the client sent it, query included) with route. */
  on(key: string, route: Route): void;
  count(key: string): number;
}

export function fakeFetch(): FakeFetch {
  const routes = new Map<string, Route>();
  const calls: Call[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = String(input);
    const call: Call = {
      method,
      path,
      headers: new Headers(init?.headers),
      body: init?.body === undefined || init.body === null ? undefined : String(init.body),
    };
    calls.push(call);
    const route = routes.get(`${method} ${path}`);
    if (!route) throw new TypeError(`fake fetch: no route for ${method} ${path}`);
    return route(call);
  };
  return {
    fetch: impl as typeof fetch,
    calls,
    on: (key, route) => routes.set(key, route),
    count: (key) => calls.filter((c) => `${c.method} ${c.path}` === key).length,
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function problem(status: number, code: string, title = 'Refused'): Response {
  const body: Problem = { error: title, title, status, code: code as Problem['code'] };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export function session(overrides: Partial<Session> = {}): Session {
  return { csrf: 'token-1', device: 'iPad', networked: true, machine: 'leto', ...overrides };
}

export function state(seq: number, overrides: Partial<State> = {}): State {
  return {
    info: {} as State['info'],
    seq,
    configPath: '/config.yaml',
    config: '',
    httpsPort: 443,
    httpPort: 80,
    webPort: 6327,
    noHosts: false,
    noCapture: false,
    projects: {},
    servers: {},
    passthroughs: [],
    documents: [],
    grants: [],
    approvals: [],
    clients: 1,
    ...overrides,
  };
}

export function envelope(seq: number, overrides: Partial<Envelope> = {}): Envelope {
  return { seq, kind: 'event', ...overrides };
}

/** An EventSource the test opens, feeds and drops by hand. */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static reset() {
    FakeEventSource.instances = [];
  }
  static get last(): FakeEventSource {
    const last = FakeEventSource.instances.at(-1);
    if (!last) throw new Error('no EventSource was opened');
    return last;
  }

  readonly url: string;
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.(new Event('open'));
  }

  send(envelope: Envelope) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(envelope) }));
  }

  drop() {
    this.onerror?.(new Event('error'));
  }
}
