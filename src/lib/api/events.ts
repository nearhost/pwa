// Follows the core's event stream: reads GET /v1/state, then GET /v1/events?after=<its seq> as
// server-sent events. A reset envelope, or a gap in the numbers, reads the state again. A dropped
// stream is retried after 1 s, 2 s, 5 s and then every 10 s, each try reading the state first, so
// what a client shows is never older than the stream it follows. A 401 ends it all.
//
// The core sends a `heartbeat` event every 15 s. A stream that has carried no event of any kind
// for 40 s is half-open (an iPad that slept, a network that changed) and counts as dropped. It
// also reconnects at once when the page is shown again after being hidden, and when the browser
// is back online.
import { NotSignedIn, type Client } from './client.js';
import type { Envelope, State } from './types.js';

export type Connection = 'connecting' | 'live' | 'lost' | 'signed-out';

/** How long a state read may take before it counts as a failure. */
export const readTimeout = 8000;

/** After a wake, how long the old status stands before it turns to connecting. */
export const wakeGrace = 400;

/** How long a stream may carry no event (the core's heartbeat is every 15 s) before it is lost. */
export const silenceLimit = 40_000;

/** The waits before each try after a drop; the last one repeats. */
export const backoff = [1000, 2000, 5000, 10000] as const;

interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: 'heartbeat', listener: (event: MessageEvent) => void): void;
  close(): void;
}

export interface EventsOptions {
  client: Client;
  /** A state read at the start, after a reset or a gap, and on each reconnect. */
  onState(state: State): void;
  /**
   * Each envelope numbered after the state, in order, once. Returning true reads the state again
   * (envelopes that arrive meanwhile wait, and the ones the new state includes are dropped, so a
   * burst of them costs one read).
   */
  onEnvelope(envelope: Envelope): boolean | void;
  /** A reset arrived; the state is being read again. */
  onReset?(): void;
  onStatus?(status: Connection): void;
  signal: AbortSignal;
  EventSource?: new (url: string) => EventSourceLike;
  /** Where visibilitychange comes from; the page's document by default. */
  document?: EventTarget & { readonly visibilityState: DocumentVisibilityState };
  /** Where online comes from; the window by default. */
  window?: EventTarget;
}

export function openEvents(opts: EventsOptions): void {
  const { client, signal } = opts;
  const Source = opts.EventSource ?? globalThis.EventSource;
  let seq = 0;
  let source: EventSourceLike | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Fires when the stream has been silent for silenceLimit.
  let silence: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  // While the state is read again, envelopes wait here.
  let held: Envelope[] | undefined;
  // Each connection's number. A read or a stream from an older one is ignored when it ends.
  let generation = 0;
  let stopped = false;

  let shown: Connection = 'connecting';
  let grace: ReturnType<typeof setTimeout> | undefined;
  const status = (s: Connection) => {
    clearTimeout(grace);
    if (signal.aborted) return;
    shown = s;
    opts.onStatus?.(s);
  };

  const current = (g: number) => g === generation && !signal.aborted;

  // Reads the state for connection g. False when g has been replaced meanwhile.
  async function load(g: number): Promise<boolean> {
    // A read that hangs (a network that cannot reach the machine) fails after readTimeout.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException('The state read took too long', 'TimeoutError')),
      readTimeout,
    );
    let state;
    try {
      state = await client.get('/v1/state', { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!current(g)) return false;
    seq = state.seq;
    opts.onState(state);
    return true;
  }

  async function connect() {
    const g = ++generation;
    held = undefined;
    try {
      if (!(await load(g))) return;
    } catch (error) {
      if (current(g)) fail(error);
      return;
    }
    const es = new Source(client.url(`/v1/events?after=${seq}`));
    source = es;
    heard();
    es.onopen = () => {
      if (source !== es) return;
      heard();
      attempt = 0;
      status('live');
    };
    es.addEventListener('heartbeat', () => {
      if (source === es) heard();
    });
    es.onmessage = (event) => {
      if (source !== es) return;
      heard();
      let envelope: Envelope;
      try {
        envelope = JSON.parse(String(event.data)) as Envelope;
      } catch {
        return;
      }
      receive(envelope);
    };
    es.onerror = () => {
      if (source !== es) return;
      fail();
    };
  }

  // The stream carried something: it is not half-open. Its silence is counted from now.
  function heard() {
    clearTimeout(silence);
    silence = setTimeout(() => fail(), silenceLimit);
  }

  function receive(envelope: Envelope) {
    if (signal.aborted) return;
    if (held) {
      held.push(envelope);
      return;
    }
    if (envelope.kind === 'reset') {
      opts.onReset?.();
      void resync([]);
      return;
    }
    if (envelope.seq <= seq) return;
    if (envelope.seq > seq + 1) {
      void resync([envelope]);
      return;
    }
    seq = envelope.seq;
    if (opts.onEnvelope(envelope) === true) void resync([]);
  }

  async function resync(waiting: Envelope[]) {
    const g = generation;
    held = waiting;
    try {
      if (!(await load(g))) return;
    } catch (error) {
      if (current(g)) fail(error);
      return;
    }
    const replay = held;
    held = undefined;
    // Ones in the state are dropped; a gap left after it reads the state once more.
    for (const envelope of replay) receive(envelope);
  }

  function close() {
    clearTimeout(silence);
    const es = source;
    source = undefined;
    es?.close();
  }

  function fail(error?: unknown) {
    generation++;
    held = undefined;
    close();
    if (signal.aborted) return;
    if (error instanceof NotSignedIn) {
      stopped = true;
      status('signed-out');
      return;
    }
    status('lost');
    const wait = backoff[Math.min(attempt, backoff.length - 1)];
    attempt++;
    clearTimeout(timer);
    timer = setTimeout(() => void connect(), wait);
  }

  // Drops the stream, and any read or wait in progress, and connects again now.
  function reconnect() {
    if (stopped || signal.aborted) return;
    clearTimeout(timer);
    close();
    attempt = 0;
    // The stream that looked live may be half-open: unless the new one opens within the grace,
    // say so. Live comes back only from the new stream's onopen.
    if (shown === 'live') {
      clearTimeout(grace);
      grace = setTimeout(() => status('connecting'), wakeGrace);
    }
    void connect();
  }

  const doc = opts.document ?? globalThis.document;
  const win = opts.window ?? (typeof window === 'undefined' ? undefined : window);
  let hidden = doc?.visibilityState === 'hidden';
  const onVisibility = () => {
    if (!doc) return;
    if (doc.visibilityState === 'hidden') {
      hidden = true;
    } else if (hidden) {
      hidden = false;
      reconnect();
    }
  };
  doc?.addEventListener('visibilitychange', onVisibility);
  win?.addEventListener('online', reconnect);

  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    clearTimeout(grace);
    close();
    doc?.removeEventListener('visibilitychange', onVisibility);
    win?.removeEventListener('online', reconnect);
  });

  status('connecting');
  void connect();
}
