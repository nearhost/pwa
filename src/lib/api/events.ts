// Follows the core's event stream: reads GET /v1/state, then GET /v1/events?after=<its seq> as
// server-sent events. A reset envelope, or a gap in the numbers, reads the state again. A dropped
// stream is retried after 1 s, 2 s, 5 s and then every 10 s, each try reading the state first, so
// what a client shows is never older than the stream it follows. A 401 ends it all.
import { NotSignedIn, type Client } from './client.js';
import type { Envelope, State } from './types.js';

export type Connection = 'connecting' | 'live' | 'lost' | 'signed-out';

/** The waits before each try after a drop; the last one repeats. */
export const backoff = [1000, 2000, 5000, 10000] as const;

interface EventSourceLike {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface EventsOptions {
  client: Client;
  /** A state read at the start, after a reset or a gap, and on each reconnect. */
  onState(state: State): void;
  /** Each envelope numbered after the state, in order, once. */
  onEnvelope(envelope: Envelope): void;
  /** A reset arrived; the state is being read again. */
  onReset?(): void;
  onStatus?(status: Connection): void;
  signal: AbortSignal;
  EventSource?: new (url: string) => EventSourceLike;
}

export function openEvents(opts: EventsOptions): void {
  const { client, signal } = opts;
  const Source = opts.EventSource ?? globalThis.EventSource;
  let seq = 0;
  let source: EventSourceLike | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  // While the state is read again, envelopes wait here.
  let held: Envelope[] | undefined;

  const status = (s: Connection) => {
    if (!signal.aborted) opts.onStatus?.(s);
  };

  async function load() {
    const state = await client.get('/v1/state');
    if (signal.aborted) return;
    seq = state.seq;
    opts.onState(state);
  }

  async function connect() {
    try {
      await load();
    } catch (error) {
      fail(error);
      return;
    }
    if (signal.aborted) return;
    const es = new Source(client.url(`/v1/events?after=${seq}`));
    source = es;
    es.onopen = () => {
      attempt = 0;
      status('live');
    };
    es.onmessage = (event) => {
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
    opts.onEnvelope(envelope);
  }

  async function resync(waiting: Envelope[]) {
    held = waiting;
    try {
      await load();
    } catch (error) {
      held = undefined;
      fail(error);
      return;
    }
    const replay = held;
    held = undefined;
    // Ones in the state are dropped; a gap left after it reads the state once more.
    for (const envelope of replay) receive(envelope);
  }

  function close() {
    const es = source;
    source = undefined;
    es?.close();
  }

  function fail(error?: unknown) {
    close();
    if (signal.aborted) return;
    if (error instanceof NotSignedIn) {
      status('signed-out');
      return;
    }
    status('lost');
    const wait = backoff[Math.min(attempt, backoff.length - 1)];
    attempt++;
    clearTimeout(timer);
    timer = setTimeout(() => void connect(), wait);
  }

  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    close();
  });

  status('connecting');
  void connect();
}
