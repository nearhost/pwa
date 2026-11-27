import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '#lib/api/client.js';
import {
  FakeEventSource,
  envelope,
  fakeFetch,
  json,
  problem,
  session,
  state,
} from '#lib/api/testing.js';
import type { State } from '#lib/api/types.js';
import { appState, startState } from './state.svelte.js';

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
}

const approval = { id: 'a1', pass: {} } as NonNullable<State['approvals']>[number];

function setup(first: State = state(5)) {
  const fake = fakeFetch();
  fake.on('GET /api/v1/session', () => json(session()));
  fake.on('GET /api/v1/state', () => json(first));
  const client = createClient({ fetch: fake.fetch });
  const stop = startState(client, { EventSource: FakeEventSource });
  return { fake, client, stop };
}

let stops: (() => void)[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
  FakeEventSource.reset();
});

afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
  vi.useRealTimers();
});

describe('startState', () => {
  it('connects, then is live with the session and the state', async () => {
    const t = setup();
    stops.push(t.stop);
    expect(appState.connection).toBe('connecting');
    await settle();
    FakeEventSource.last.open();
    expect(appState.connection).toBe('live');
    expect(appState.session?.machine).toBe('leto');
    expect(appState.state?.seq).toBe(5);
  });

  it('applies approvals and their ends at once, before reading the state again', async () => {
    const t = setup(state(5, { approvals: [] }));
    stops.push(t.stop);
    await settle();
    const es = FakeEventSource.last;
    es.open();
    let answer!: (r: Response) => void;
    t.fake.on('GET /api/v1/state', () => new Promise<Response>((r) => (answer = r)));
    es.send({ seq: 5, kind: 'approval', approval: { ...approval, id: 'old' } });
    es.send({ seq: 6, kind: 'approval', approval });
    expect(appState.state?.seq).toBe(6);
    expect(appState.state?.approvals?.map((a) => a.id)).toEqual(['a1']);
    answer(json(state(6, { approvals: [approval] })));
    await settle();
    t.fake.on('GET /api/v1/state', () => new Promise<Response>((r) => (answer = r)));
    es.send({ seq: 7, kind: 'ended', id: 'a1' });
    expect(appState.state?.approvals).toEqual([]);
    expect(appState.state?.seq).toBe(7);
    answer(json(state(7, { approvals: [] })));
    await settle();
    expect(appState.state?.approvals).toEqual([]);
  });

  it("applies a project's state change", async () => {
    const shop = { State: 'starting' } as NonNullable<State['projects']>[string];
    const t = setup(state(5, { projects: { shop } }));
    stops.push(t.stop);
    await settle();
    const es = FakeEventSource.last;
    es.open();
    es.send(
      envelope(6, {
        event: { Time: '', Project: 'shop', Server: '', State: 'running', Message: '' },
      }),
    );
    expect(appState.state?.projects?.shop?.State).toBe('running');
    // A log line has no state, and leaves the project's alone.
    es.send(
      envelope(7, { event: { Time: '', Project: 'shop', Server: '', State: '', Message: 'hi' } }),
    );
    expect(appState.state?.projects?.shop?.State).toBe('running');
  });

  it("applies a project's state change fully: state, message and problem", async () => {
    const shop = {
      State: 'running',
      Message: '',
      Problem: null,
    } as unknown as NonNullable<State['projects']>[string];
    const t = setup(state(5, { projects: { shop } }));
    stops.push(t.stop);
    await settle();
    const es = FakeEventSource.last;
    es.open();
    const report = { code: 'engine.port-taken', level: 'error', title: 'port 8000 is taken' };
    es.send(
      envelope(6, {
        event: {
          Time: '',
          Project: 'shop',
          Server: '',
          State: 'error',
          Message: 'state: error: port 8000 is taken',
          Report: report as never,
        },
      }),
    );
    expect(appState.state?.projects?.shop?.State).toBe('error');
    expect(appState.state?.projects?.shop?.Message).toBe('port 8000 is taken');
    expect(appState.state?.projects?.shop?.Problem).toEqual(report);
    // A log line leaves the message and the problem alone.
    es.send(
      envelope(7, { event: { Time: '', Project: 'shop', Server: '', State: '', Message: 'hi' } }),
    );
    expect(appState.state?.projects?.shop?.Message).toBe('port 8000 is taken');
    es.send(
      envelope(8, {
        event: {
          Time: '',
          Project: 'shop',
          Server: '',
          State: 'running',
          Message: 'state: running',
        },
      }),
    );
    expect(appState.state?.projects?.shop?.State).toBe('running');
    expect(appState.state?.projects?.shop?.Message).toBe('');
    expect(appState.state?.projects?.shop?.Problem).toBeNull();
    expect(t.fake.count('GET /api/v1/state')).toBe(1);
  });

  describe('reads the state again', () => {
    const server = (status: string) =>
      ({ health: {}, status, message: '' }) as unknown as NonNullable<State['servers']>[string];

    async function live(first: State) {
      const t = setup(first);
      stops.push(t.stop);
      await settle();
      FakeEventSource.last.open();
      return t;
    }

    it("on a server's event, which carries no state of its own", async () => {
      const t = await live(state(5, { servers: { box: server('connecting') } }));
      t.fake.on('GET /api/v1/state', () =>
        json(state(6, { servers: { box: server('connected') } })),
      );
      FakeEventSource.last.send(
        envelope(6, {
          event: { Time: '', Project: '', Server: 'box', State: '', Message: 'connected' },
        }),
      );
      await settle();
      expect(t.fake.count('GET /api/v1/state')).toBe(2);
      expect(appState.state?.servers?.box?.status).toBe('connected');
    });

    it('on a state change of a project it does not know yet', async () => {
      const t = await live(state(5));
      const shop = { State: 'starting' } as NonNullable<State['projects']>[string];
      t.fake.on('GET /api/v1/state', () => json(state(6, { projects: { shop } })));
      FakeEventSource.last.send(
        envelope(6, {
          event: { Time: '', Project: 'shop', Server: '', State: 'starting', Message: '' },
        }),
      );
      await settle();
      expect(t.fake.count('GET /api/v1/state')).toBe(2);
      expect(appState.state?.projects?.shop?.State).toBe('starting');
    });

    for (const kind of ['approval', 'ended', 'opened', 'shown', 'config', 'reset'] as const) {
      it(`on ${kind === 'approval' || kind === 'ended' ? 'an' : 'a'} ${kind} envelope`, async () => {
        const t = await live(state(5));
        t.fake.on('GET /api/v1/state', () => json(state(6, { clients: 2 })));
        FakeEventSource.last.send(
          kind === 'approval' ? { seq: 6, kind, approval } : envelope(6, { kind }),
        );
        await settle();
        expect(t.fake.count('GET /api/v1/state')).toBe(2);
        expect(appState.state?.clients).toBe(2);
      });
    }

    it('once for a burst of envelopes', async () => {
      const t = await live(state(5));
      let answer!: (r: Response) => void;
      t.fake.on('GET /api/v1/state', () => new Promise<Response>((r) => (answer = r)));
      const es = FakeEventSource.last;
      es.send({ seq: 6, kind: 'approval', approval });
      es.send(envelope(7, { kind: 'config' }));
      es.send(envelope(8, { kind: 'shown' }));
      es.send(
        envelope(9, { event: { Time: '', Project: '', Server: 'box', State: '', Message: '' } }),
      );
      await settle();
      expect(t.fake.count('GET /api/v1/state')).toBe(2);
      answer(json(state(9, { clients: 3 })));
      await settle();
      expect(t.fake.count('GET /api/v1/state')).toBe(2);
      expect(appState.state?.clients).toBe(3);
    });

    it('not on a project log line or a known project state change', async () => {
      const shop = { State: 'starting', Message: '' } as NonNullable<State['projects']>[string];
      const t = await live(state(5, { projects: { shop } }));
      FakeEventSource.last.send(
        envelope(6, { event: { Time: '', Project: 'shop', Server: '', State: '', Message: 'x' } }),
      );
      FakeEventSource.last.send(
        envelope(7, {
          event: { Time: '', Project: 'shop', Server: '', State: 'running', Message: '' },
        }),
      );
      await settle();
      expect(t.fake.count('GET /api/v1/state')).toBe(1);
    });
  });

  it('says signed out on a 401', async () => {
    const fake = fakeFetch();
    fake.on('GET /api/v1/session', () => problem(401, 'proxy.api-sign-in'));
    fake.on('GET /api/v1/state', () => problem(401, 'proxy.api-sign-in'));
    stops.push(startState(createClient({ fetch: fake.fetch }), { EventSource: FakeEventSource }));
    await settle();
    expect(appState.connection).toBe('signed-out');
    expect(FakeEventSource.instances).toEqual([]);
  });

  it('says lost when the stream drops, and live again once back', async () => {
    const t = setup();
    stops.push(t.stop);
    await settle();
    FakeEventSource.last.open();
    FakeEventSource.last.drop();
    expect(appState.connection).toBe('lost');
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    FakeEventSource.last.open();
    expect(appState.connection).toBe('live');
  });

  it('updates lastAnswered on every successful answer', async () => {
    const t = setup();
    stops.push(t.stop);
    expect(appState.lastAnswered).toBeUndefined();
    await settle();
    const afterReads = appState.lastAnswered?.getTime();
    expect(afterReads).toBe(Date.parse('2026-11-27T10:00:00Z'));

    vi.setSystemTime(new Date('2026-11-27T10:00:05Z'));
    FakeEventSource.last.open();
    expect(appState.lastAnswered?.getTime()).toBe(Date.parse('2026-11-27T10:00:05Z'));

    vi.setSystemTime(new Date('2026-11-27T10:00:09Z'));
    FakeEventSource.last.send(envelope(6));
    expect(appState.lastAnswered?.getTime()).toBe(Date.parse('2026-11-27T10:00:09Z'));

    vi.setSystemTime(new Date('2026-11-27T10:00:20Z'));
    t.fake.on('POST /api/v1/projects/shop/recheck', () => new Response(null, { status: 204 }));
    await t.client.send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' });
    expect(appState.lastAnswered?.getTime()).toBe(Date.parse('2026-11-27T10:00:20Z'));

    // A failure is not an answer to count.
    vi.setSystemTime(new Date('2026-11-27T10:00:30Z'));
    t.fake.on('POST /api/v1/projects/shop/recheck', () => problem(500, 'unexpected'));
    await t.client
      .send('POST', '/v1/projects/{name}/recheck', undefined, { name: 'shop' })
      .catch(() => {});
    expect(appState.lastAnswered?.getTime()).toBe(Date.parse('2026-11-27T10:00:20Z'));
  });

  it('stops following once stopped', async () => {
    const t = setup();
    await settle();
    const es = FakeEventSource.last;
    t.stop();
    expect(es.closed).toBe(true);
  });
});
