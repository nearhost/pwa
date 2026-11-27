// The app's client for the core's API, served on the page's own origin at /api. Reads are plain
// GETs. Writes carry the token from GET /api/v1/session in X-Nearhost-CSRF and always say
// Content-Type: application/json, body or not, or the core's gate refuses them.
import type {
  BodyOf,
  GetPaths,
  MethodsOf,
  ParamsOf,
  Problem,
  Response200,
  ResponseOf,
  Session,
  WritePaths,
} from './types.js';

/** A failed answer from the API, with the problem it was answered with. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(status: number, problem: Problem) {
    super(problem.detail ? `${problem.title}: ${problem.detail}` : problem.title);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

/** A 401: the browser has neither the page's cookie nor a paired device's. */
export class NotSignedIn extends ApiError {
  constructor(problem: Problem) {
    super(401, problem);
    this.name = 'NotSignedIn';
  }
}

export interface ClientObserver {
  /** The core answered a request successfully. */
  answered?(): void;
  /** The core answered 401. */
  signedOut?(): void;
}

export interface Client {
  /** Where the API is, such as /api. */
  readonly base: string;
  /** The address of path (such as /v1/events?after=3) under the base. */
  url(path: string): string;
  /** Reads the session, keeping its token for writes. */
  session(): Promise<Session>;
  get<P extends GetPaths>(path: P): Promise<Response200<P>>;
  send<P extends WritePaths, M extends MethodsOf<P>>(
    method: M,
    path: P,
    body?: BodyOf<P, M>,
    params?: ParamsOf<P>,
  ): Promise<ResponseOf<P, M>>;
  /** Tells observer of answers and sign-outs until the returned function is called. */
  observe(observer: ClientObserver): () => void;
}

const writeRefused = 'proxy.api-write-refused';

export function createClient(opts: { base?: string; fetch?: typeof fetch } = {}): Client {
  const base = opts.base ?? '/api';
  const doFetch = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const observers = new Set<ClientObserver>();
  let token: Promise<string> | undefined;

  const url = (path: string) => base + path;

  function tell(event: keyof ClientObserver) {
    for (const observer of observers) observer[event]?.();
  }

  // Sends one request and returns its answer's body: the JSON, or undefined when it is empty.
  async function request(method: string, path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await doFetch(url(path), { ...init, method });
    const text = await res.text();
    if (!res.ok) throw failure(res, text);
    let body: unknown;
    if (text !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiError(res.status, made(res.status, 'The answer was not JSON'));
      }
    }
    tell('answered');
    return body;
  }

  function failure(res: Response, text: string): ApiError {
    let problem: Problem | undefined;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && 'title' in parsed) problem = parsed as Problem;
    } catch {
      // Not a problem from the core, such as a proxy's error page.
    }
    problem ??= made(res.status, res.statusText || `The core answered ${res.status}`);
    if (res.status === 401) {
      tell('signedOut');
      return new NotSignedIn(problem);
    }
    return new ApiError(res.status, problem);
  }

  async function session(): Promise<Session> {
    const read = request('GET', '/v1/session') as Promise<Session>;
    const next = read.then((s) => s.csrf);
    token = next;
    // A failed read leaves no token behind, so the next write reads the session again.
    next.catch(() => {
      if (token === next) token = undefined;
    });
    return read;
  }

  async function write(method: string, path: string, body: unknown, csrf: string) {
    return request(method, path, {
      headers: { 'X-Nearhost-CSRF': csrf, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  return {
    base,
    url,
    session,
    get: (path) => request('GET', path) as Promise<never>,
    async send(method, path, body, params) {
      const filled = fill(path, params as Record<string, string> | undefined);
      const csrf = await (token ?? session().then((s) => s.csrf));
      try {
        return (await write(method, filled, body, csrf)) as never;
      } catch (error) {
        // The token changes when the device is paired again: read it once more and retry once.
        if (
          !(error instanceof ApiError) ||
          error.status !== 403 ||
          error.problem.code !== writeRefused
        )
          throw error;
        const fresh = await session();
        return (await write(method, filled, body, fresh.csrf)) as never;
      }
    },
    observe(observer) {
      observers.add(observer);
      return () => observers.delete(observer);
    },
  };
}

function made(status: number, title: string): Problem {
  return { error: title, title, status };
}

function fill(path: string, params: Record<string, string> | undefined): string {
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`missing path parameter ${name} for ${path}`);
    return encodeURIComponent(value);
  });
}
