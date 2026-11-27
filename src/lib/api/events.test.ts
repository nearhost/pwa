import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client.js';
import { openEvents, type Connection } from './events.js';
import { FakeEventSource, envelope, fakeFetch, json, problem, state } from './testing.js';
import type { Envelope, State } from './types.js';

const getState = 'GET /api/v1/state';

function setup(firstSeq = 5) {
  const fake = fakeFetch();
  let seq = firstSeq;
  fake.on(getState, () => json(state(seq)));
  const client = createClient({ fetch: fake.fetch });
  const states: State[] = [];
  const envelopes: Envelope[] = [];
  const statuses: Connection[] = [];
  const onReset = vi.fn();
  const controller = new AbortController();
  openEvents({
    client,
    signal: controller.signal,
    EventSource: FakeEventSource,
    onState: (s) => states.push(s),
    onEnvelope: (e) => envelopes.push(e),
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
    setSeq: (n: number) => (seq = n),
  };
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
});
