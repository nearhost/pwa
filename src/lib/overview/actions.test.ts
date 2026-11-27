import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '#lib/api/client.js';
import { FakeEventSource, fakeFetch, json, session, state } from '#lib/api/testing.js';
import { appState, startState } from '#lib/state.svelte.js';
import { actionError, actionLimit, projectActions, startStop } from './actions.svelte.js';

let stop: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.reset();
  const fake = fakeFetch();
  fake.on('GET /api/v1/session', () => json(session()));
  fake.on('GET /api/v1/state', () => json(state(1)));
  fake.on('POST /api/v1/projects/shop/start', () => new Promise<Response>(() => {}));
  stop = startState(createClient({ fetch: fake.fetch }), { EventSource: FakeEventSource });
});

afterEach(() => {
  stop();
  for (const k of Object.keys(projectActions.errors)) delete projectActions.errors[k];
  vi.useRealTimers();
});

async function timeOut() {
  const ask = startStop('shop', 'start', 'stopped');
  await vi.advanceTimersByTimeAsync(actionLimit + 1);
  await ask;
}

describe('start and stop errors', () => {
  it("say the core hasn't answered yet, without blaming a live connection", async () => {
    await vi.advanceTimersByTimeAsync(0);
    FakeEventSource.last.open();
    expect(appState.connection).toBe('live');
    await timeOut();
    expect(actionError('shop', 'stopped')).toBe(
      "leto hasn't answered yet. shop may still start; its state shows here when it does.",
    );
    expect(projectActions.pending.shop).toBeUndefined();
  });

  it('say the connection is the reason when it is not live', async () => {
    await timeOut();
    expect(actionError('shop', 'stopped')).toBe(
      'No answer to start shop. Try again when the connection is back.',
    );
  });

  it("clear once the project's state changes", async () => {
    await timeOut();
    expect(actionError('shop', 'stopped')).toBeDefined();
    expect(actionError('shop', 'running')).toBeUndefined();
  });
});
