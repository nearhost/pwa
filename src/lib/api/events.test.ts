import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client.js';
import { openEvents, type Connection } from './events.js';
import { FakeEventSource, envelope, fakeFetch, json, problem, state } from './testing.js';
import type { Envelope, State } from './types.js';

const getState = 'GET /api/v1/state';

function setup(firstSeq = 5, refetch?: (envelope: Envelope) => boolean) {
  const fake = fakeFetch();
  let seq = firstSeq;
  fake.on(getState, () => json(state(seq)));
  const client = createClient({ fetch: fake.fetch });
  const states: State[] = [];
  const envelopes: Envelope[] = [];
  const statuses: Connection[] = [];
  const onReset = vi.fn();
  const controller = new AbortController();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  });
  const win = new EventTarget();
  openEvents({
    client,
    signal: controller.signal,
    EventSource: FakeEventSource,
    document: doc,
    window: win,
    onState: (s) => states.push(s),
    onEnvelope: (e) => {
      envelopes.push(e);
      return refetch?.(e);
    },
    onReset,
    onStatus: (s) => statuses.push(s),
  });
  return {
    fake,
    states,
    envelopes,
    statuses,
    onReset,
    controller,
    doc,
    win,
    setSeq: (n: number) => (seq = n),
  };
}

// A state read the test answers, or fails, when it chooses.
function pending() {
  let answer!: (r: Response) => void;
  let refuse!: (e: unknown) => void;
  const promise = new Promise<Response>((resolve, reject) => {
    answer = resolve;
    refuse = reject;
  });
  return { route: () => promise, answer, refuse };
}

// Lets the fake fetch's promises settle.
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('openEvents', () => {
  it('reads the state, then follows the stream after its seq', async () => {
    const t = setup(5);
    await settle();
    expect(t.states.map((s) => s.seq)).toEqual([5]);
    expect(FakeEventSource.last.url).toBe('/api/v1/events?after=5');
    expect(t.statuses).toEqual(['connecting']);
    FakeEventSource.last.open();
    expect(t.statuses.at(-1)).toBe('live');
  });

  it('applies envelopes after the state seq and ignores ones at or below it', async () => {
    const t = setup(5);
    await settle();
    const es = FakeEventSource.last;
    es.open();
    es.send(envelope(4));
    es.send(envelope(5));
    es.send(envelope(6));
    es.send(envelope(7));
    es.send(envelope(7));
    expect(t.envelopes.map((e) => e.seq)).toEqual([6, 7]);
    expect(t.fake.count(getState)).toBe(1);
  });

  it('reads the state once more on a reset, and goes on from it', async () => {
    const t = setup(5);
    await settle();
    const es = FakeEventSource.last;
    es.open();
    t.setSeq(40);
    es.send({ seq: 40, kind: 'reset' });
    await settle();
    expect(t.onReset).toHaveBeenCalledOnce();
    expect(t.fake.count(getState)).toBe(2);
    expect(t.states.map((s) => s.seq)).toEqual([5, 40]);
    es.send(envelope(41));
    expect(t.envelopes.map((e) => e.seq)).toEqual([41]);
    // The stream stays open: a reset is not a drop.
    expect(es.closed).toBe(false);
    expect(t.statuses.at(-1)).toBe('live');
  });

  it('goes on after a reset to a lower number, as from a core that restarted', async () => {
    const t = setup(50);
    await settle();
    const es = FakeEventSource.last;
    es.open();
    t.setSeq(2);
    es.send({ seq: 2, kind: 'reset' });
    await settle();
    es.send(envelope(3));
    expect(t.envelopes.map((e) => e.seq)).toEqual([3]);
  });

  it('reads the state once on a gap in seq, holding what arrives meanwhile', async () => {
    const t = setup(5);
    await settle();
    const es = FakeEventSource.last;
    es.open();
    t.setSeq(8);
    es.send(envelope(8));
    es.send(envelope(9));
    await settle();
    expect(t.fake.count(getState)).toBe(2);
    expect(t.states.map((s) => s.seq)).toEqual([5, 8]);
    // 8 is in the new state; 9 comes after it.
    expect(t.envelopes.map((e) => e.seq)).toEqual([9]);
  });

  it('marks a dropped stream lost and reconnects on the backoff schedule', async () => {
    const t = setup(5);
    await settle();
    FakeEventSource.last.open();
    const delays = [1000, 2000, 5000, 10000, 10000];
    // The core is gone: every state read fails until it is back.
    t.fake.on(getState, () => Promise.reject(new TypeError('Failed to fetch')));
    FakeEventSource.last.drop();
    expect(FakeEventSource.instances[0]!.closed).toBe(true);
    expect(t.statuses.at(-1)).toBe('lost');
    let reads = t.fake.count(getState);
    for (const delay of delays) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(t.fake.count(getState)).toBe(reads);
      await vi.advanceTimersByTimeAsync(1);
      await settle();
      expect(t.fake.count(getState)).toBe(reads + 1);
      reads++;
      expect(t.statuses.at(-1)).toBe('lost');
    }
    // Back: the next try reads the state, opens the stream after it, and is live.
    t.setSeq(12);
    t.fake.on(getState, () => json(state(12)));
    await vi.advanceTimersByTimeAsync(10000);
    await settle();
    expect(FakeEventSource.last.url).toBe('/api/v1/events?after=12');
    expect(t.statuses.at(-1)).toBe('lost');
    FakeEventSource.last.open();
    expect(t.statuses.at(-1)).toBe('live');
  });

  it('starts the backoff again after the stream was live', async () => {
    setup(5);
    await settle();
    FakeEventSource.last.open();
    FakeEventSource.last.drop();
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    FakeEventSource.last.open();
    FakeEventSource.last.drop();
    const count = FakeEventSource.instances.length;
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(FakeEventSource.instances.length).toBe(count + 1);
  });

  it('stops on a 401 and says signed out', async () => {
    const t = setup(5);
    await settle();
    FakeEventSource.last.open();
    t.fake.on(getState, () => problem(401, 'proxy.api-sign-in'));
    FakeEventSource.last.drop();
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(t.statuses.at(-1)).toBe('signed-out');
    const count = FakeEventSource.instances.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeEventSource.instances.length).toBe(count);
    expect(t.fake.count(getState)).toBe(2);
  });

  it('closes the stream and stops trying once aborted', async () => {
    const t = setup(5);
    await settle();
    const es = FakeEventSource.last;
    t.controller.abort();
    expect(es.closed).toBe(true);
    es.drop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeEventSource.instances.length).toBe(1);
    expect(t.fake.count(getState)).toBe(1);
  });

  describe('a refetch still running when the stream drops', () => {
    async function dropDuringResync() {
      const t = setup(5);
      await settle();
      FakeEventSource.last.open();
      const stale = pending();
      t.fake.on(getState, stale.route);
      // A gap starts a refetch (A), which hangs; then the stream drops.
      FakeEventSource.last.send(envelope(9));
      await settle();
      FakeEventSource.last.drop();
      // The reconnect's read (B) answers with a newer state, and the new stream opens.
      t.fake.on(getState, () => json(state(20)));
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      const healthy = FakeEventSource.last;
      healthy.open();
      return { t, stale, healthy };
    }

    it('lets the new stream apply its envelopes', async () => {
      const { t, healthy } = await dropDuringResync();
      expect(t.statuses.at(-1)).toBe('live');
      healthy.send(envelope(21));
      expect(t.envelopes.map((e) => e.seq)).toEqual([21]);
    });

    it('drops the stale state when it answers late', async () => {
      const { t, stale, healthy } = await dropDuringResync();
      stale.answer(json(state(10)));
      await settle();
      expect(t.states.map((s) => s.seq)).toEqual([5, 20]);
      healthy.send(envelope(21));
      expect(t.envelopes.map((e) => e.seq)).toEqual([21]);
    });

    it('does not close the new stream when it fails late', async () => {
      const { t, stale, healthy } = await dropDuringResync();
      const opened = FakeEventSource.instances.length;
      stale.refuse(new TypeError('Failed to fetch'));
      await settle();
      expect(healthy.closed).toBe(false);
      expect(t.statuses.at(-1)).toBe('live');
      // The core's heartbeats keep the new stream live meanwhile.
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(15000);
        healthy.heartbeat();
      }
      expect(FakeEventSource.instances.length).toBe(opened);
      expect(t.statuses.at(-1)).toBe('live');
    });
  });

  describe('when the app comes back', () => {
    it('reconnects at once when the page is shown again after being hidden', async () => {
      const t = setup(5);
      await settle();
      const first = FakeEventSource.last;
      first.open();
      t.doc.visibilityState = 'hidden';
      t.doc.dispatchEvent(new Event('visibilitychange'));
      await settle();
      expect(FakeEventSource.instances.length).toBe(1);
      t.setSeq(30);
      t.doc.visibilityState = 'visible';
      t.doc.dispatchEvent(new Event('visibilitychange'));
      await settle();
      expect(first.closed).toBe(true);
      expect(t.fake.count(getState)).toBe(2);
      expect(FakeEventSource.last.url).toBe('/api/v1/events?after=30');
      // An old stream's late messages are not applied.
      first.send(envelope(31));
      expect(t.envelopes).toEqual([]);
    });

    it('does not reconnect on a visibilitychange that was not from hidden', async () => {
      const t = setup(5);
      await settle();
      FakeEventSource.last.open();
      t.doc.dispatchEvent(new Event('visibilitychange'));
      await settle();
      expect(FakeEventSource.instances.length).toBe(1);
      expect(t.fake.count(getState)).toBe(1);
    });

    it('reconnects at once when the network comes back, skipping the backoff', async () => {
      const t = setup(5);
      await settle();
      FakeEventSource.last.open();
      t.fake.on(getState, () => Promise.reject(new TypeError('Failed to fetch')));
      FakeEventSource.last.drop();
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(t.fake.count(getState)).toBe(2);
      // The next try would wait 2 s; the network is back now.
      t.fake.on(getState, () => json(state(12)));
      t.win.dispatchEvent(new Event('online'));
      await settle();
      expect(t.fake.count(getState)).toBe(3);
      expect(FakeEventSource.last.url).toBe('/api/v1/events?after=12');
      FakeEventSource.last.open();
      expect(t.statuses.at(-1)).toBe('live');
      // The backoff's timer was cleared: no second read when it would have fired.
      await vi.advanceTimersByTimeAsync(2000);
      expect(t.fake.count(getState)).toBe(3);
    });

    it('stays stopped after signing out, and listens no more once aborted', async () => {
      const t = setup(5);
      await settle();
      t.controller.abort();
      t.win.dispatchEvent(new Event('online'));
      await settle();
      expect(t.fake.count(getState)).toBe(1);

      const u = setup(5);
      await settle();
      u.fake.on(getState, () => problem(401, 'proxy.api-sign-in'));
      FakeEventSource.last.drop();
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(u.statuses.at(-1)).toBe('signed-out');
      const reads = u.fake.count(getState);
      u.win.dispatchEvent(new Event('online'));
      await settle();
      expect(u.fake.count(getState)).toBe(reads);
    });
  });

  describe('after a wake', () => {
    async function wakeWithHangingRead() {
      const t = setup(5);
      await settle();
      FakeEventSource.last.open();
      expect(t.statuses.at(-1)).toBe('live');
      const hang = pending();
      t.fake.on(getState, hang.route);
      t.win.dispatchEvent(new Event('online'));
      await settle();
      return { t, hang };
    }

    it('says connecting, not live, once the wake read has run past 400 ms', async () => {
      const { t } = await wakeWithHangingRead();
      await vi.advanceTimersByTimeAsync(399);
      expect(t.statuses.at(-1)).toBe('live');
      await vi.advanceTimersByTimeAsync(1);
      expect(t.statuses.at(-1)).toBe('connecting');
    });

    it('says live again only when the new stream opens', async () => {
      const { t, hang } = await wakeWithHangingRead();
      await vi.advanceTimersByTimeAsync(400);
      hang.answer(json(state(9)));
      await settle();
      expect(t.statuses.at(-1)).toBe('connecting');
      FakeEventSource.last.open();
      expect(t.statuses.at(-1)).toBe('live');
    });

    it('does not flash connecting when the stream is back within 400 ms', async () => {
      const { t, hang } = await wakeWithHangingRead();
      hang.answer(json(state(9)));
      await settle();
      FakeEventSource.last.open();
      await vi.advanceTimersByTimeAsync(1000);
      expect(t.statuses).not.toContain('lost');
      expect(t.statuses.slice(1)).toEqual(['live', 'live']);
    });

    it('gives up a state read after 8 s: lost, then the backoff', async () => {
      const { t } = await wakeWithHangingRead();
      const reads = t.fake.count(getState);
      await vi.advanceTimersByTimeAsync(7999);
      expect(t.statuses.at(-1)).toBe('connecting');
      await vi.advanceTimersByTimeAsync(1);
      await settle();
      expect(t.statuses.at(-1)).toBe('lost');
      t.fake.on(getState, () => json(state(12)));
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(t.fake.count(getState)).toBe(reads + 1);
      expect(FakeEventSource.last.url).toBe('/api/v1/events?after=12');
    });
  });

  describe('the heartbeat', () => {
    it('listens for the heartbeat event by name', async () => {
      setup(5);
      await settle();
      expect(FakeEventSource.last.listeners.get('heartbeat')).toHaveLength(1);
    });

    it('stays live while heartbeats or envelopes come within 40 s', async () => {
      const t = setup(5);
      await settle();
      const es = FakeEventSource.last;
      es.open();
      await vi.advanceTimersByTimeAsync(39_000);
      es.heartbeat();
      await vi.advanceTimersByTimeAsync(39_000);
      es.send(envelope(6));
      await vi.advanceTimersByTimeAsync(39_000);
      es.heartbeat();
      await vi.advanceTimersByTimeAsync(39_999);
      expect(es.closed).toBe(false);
      expect(t.statuses.at(-1)).toBe('live');
      expect(t.fake.count(getState)).toBe(1);
    });

    it('says lost after 40 s with no event of any kind, and reconnects', async () => {
      const t = setup(5);
      await settle();
      const es = FakeEventSource.last;
      es.open();
      es.heartbeat();
      await vi.advanceTimersByTimeAsync(39_999);
      expect(t.statuses.at(-1)).toBe('live');
      await vi.advanceTimersByTimeAsync(1);
      expect(es.closed).toBe(true);
      expect(t.statuses.at(-1)).toBe('lost');
      t.setSeq(9);
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(t.fake.count(getState)).toBe(2);
      expect(FakeEventSource.last).not.toBe(es);
      expect(FakeEventSource.last.url).toBe('/api/v1/events?after=9');
      FakeEventSource.last.open();
      expect(t.statuses.at(-1)).toBe('live');
    });

    it('says lost when a stream never opens and stays silent for 40 s', async () => {
      const t = setup(5);
      await settle();
      const es = FakeEventSource.last;
      await vi.advanceTimersByTimeAsync(40_000);
      expect(es.closed).toBe(true);
      expect(t.statuses.at(-1)).toBe('lost');
    });

    it('ignores a heartbeat from a stream it has dropped', async () => {
      const t = setup(5);
      await settle();
      const first = FakeEventSource.last;
      first.open();
      await vi.advanceTimersByTimeAsync(40_000);
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      const second = FakeEventSource.last;
      second.open();
      await vi.advanceTimersByTimeAsync(30_000);
      first.heartbeat();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(second.closed).toBe(true);
      expect(t.statuses.at(-1)).toBe('lost');
    });

    it('stops watching once aborted', async () => {
      const t = setup(5);
      await settle();
      FakeEventSource.last.open();
      t.controller.abort();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(t.statuses).toEqual(['connecting', 'live']);
      expect(FakeEventSource.instances.length).toBe(1);
    });
  });

  describe('a refetch asked for by an envelope', () => {
    const isConfig = (e: Envelope) => e.kind === 'config';

    it('reads the state again and goes on from it', async () => {
      const t = setup(5, isConfig);
      await settle();
      const es = FakeEventSource.last;
      es.open();
      t.setSeq(6);
      es.send(envelope(6, { kind: 'config' }));
      await settle();
      expect(t.fake.count(getState)).toBe(2);
      expect(t.states.map((s) => s.seq)).toEqual([5, 6]);
      expect(t.envelopes.map((e) => e.seq)).toEqual([6]);
      es.send(envelope(7));
      expect(t.envelopes.map((e) => e.seq)).toEqual([6, 7]);
      expect(es.closed).toBe(false);
    });

    it('reads once for a burst the read already includes', async () => {
      const t = setup(5, isConfig);
      await settle();
      const es = FakeEventSource.last;
      es.open();
      const read = pending();
      t.fake.on(getState, read.route);
      es.send(envelope(6, { kind: 'config' }));
      es.send(envelope(7, { kind: 'config' }));
      es.send(envelope(8, { kind: 'config' }));
      await settle();
      expect(t.fake.count(getState)).toBe(2);
      read.answer(json(state(8)));
      await settle();
      expect(t.fake.count(getState)).toBe(2);
      expect(t.states.map((s) => s.seq)).toEqual([5, 8]);
      expect(t.envelopes.map((e) => e.seq)).toEqual([6]);
    });

    it('reads once more for one that came after what the read includes', async () => {
      const t = setup(5, isConfig);
      await settle();
      const es = FakeEventSource.last;
      es.open();
      const read = pending();
      t.fake.on(getState, read.route);
      es.send(envelope(6, { kind: 'config' }));
      es.send(envelope(7, { kind: 'config' }));
      es.send(envelope(8, { kind: 'config' }));
      await settle();
      t.setSeq(8);
      t.fake.on(getState, () => json(state(8)));
      read.answer(json(state(6)));
      await settle();
      expect(t.fake.count(getState)).toBe(3);
      expect(t.states.map((s) => s.seq)).toEqual([5, 6, 8]);
      expect(t.envelopes.map((e) => e.seq)).toEqual([6, 7]);
    });
  });

  it('gives up a hanging first state read after 8 s', async () => {
    const fake = fakeFetch();
    fake.on(getState, pending().route);
    const statuses: Connection[] = [];
    openEvents({
      client: createClient({ fetch: fake.fetch }),
      signal: new AbortController().signal,
      EventSource: FakeEventSource,
      document: Object.assign(new EventTarget(), { visibilityState: 'visible' as const }),
      window: new EventTarget(),
      onState: () => {},
      onEnvelope: () => {},
      onStatus: (s) => statuses.push(s),
    });
    await vi.advanceTimersByTimeAsync(8000);
    await settle();
    expect(statuses).toEqual(['connecting', 'lost']);
  });
});
