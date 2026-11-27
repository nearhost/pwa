import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '#lib/api/client.js';
import { alreadyAnswered, Answering, failureOf } from './answer.svelte.js';

const problem = (status: number, extra: object = {}) =>
  new ApiError(status, { error: 'Refused', title: 'Refused', status, ...extra });

describe('a failed answer', () => {
  it('to a request that had ended says already answered', () => {
    expect(
      failureOf(problem(409, { ended: true, code: 'control.request-ended' }), 'live', 'leto'),
    ).toEqual({ kind: 'ended', text: alreadyAnswered });
    expect(failureOf(problem(409), 'live', 'leto').kind).toBe('ended');
    expect(failureOf(problem(500, { ended: true }), 'live', 'leto').kind).toBe('ended');
  });

  it("shows the problem's title otherwise, a 409 of another kind included", () => {
    expect(failureOf(problem(409, { code: 'network.off', title: 'Off' }), 'live', 'leto')).toEqual({
      kind: 'failed',
      text: 'Off',
    });
    expect(failureOf(problem(500, { title: 'The forward failed' }), 'live', 'leto')).toEqual({
      kind: 'failed',
      text: 'The forward failed',
    });
  });

  it("says when Always allow wasn't saved, though the answer was taken", () => {
    const f = failureOf(problem(500, { allowNotSaved: true, title: 'disk full' }), 'live', 'leto');
    expect(f).toEqual({
      kind: 'not-saved',
      text: "Answered, but Always allow wasn't saved: disk full. You'll be asked again next time.",
    });
  });

  it('with no answer blames the connection only when it is not live', () => {
    expect(failureOf(new Error('timeout'), 'live', 'leto').text).toBe(
      "leto hasn't answered yet. Your answer may still count; this page shows it when it does.",
    );
    expect(failureOf(new TypeError('fetch failed'), 'lost', 'leto').text).toBe(
      'No answer from leto. Try again when the connection is back.',
    );
  });
});

describe('answering', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  const env = () => ({ connection: 'live' as const, machine: 'leto' });

  it('is busy until the core answers, then done; a second answer is not sent', async () => {
    const a = new Answering(env);
    let resolve!: () => void;
    const ask = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const sent = a.send('yes', ask);
    expect(a.busy).toBe('yes');
    void a.send('no', ask);
    expect(ask).toHaveBeenCalledTimes(1);
    resolve();
    await sent;
    expect(a.busy).toBeUndefined();
    expect(a.done).toBe('yes');
    await a.send('no', ask);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('gives the buttons back with the failure, and lets the user try again', async () => {
    const a = new Answering(env);
    await a.send('yes', () => Promise.reject(problem(500, { title: 'The forward failed' })));
    expect(a.busy).toBeUndefined();
    expect(a.done).toBeUndefined();
    expect(a.failure).toEqual({ kind: 'failed', text: 'The forward failed' });
    await a.send('yes', () => Promise.resolve());
    expect(a.failure).toBeUndefined();
    expect(a.done).toBe('yes');
  });

  it('never stays busy past the limit', async () => {
    const a = new Answering(env, 1000);
    const sent = a.send('yes', () => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(1001);
    await sent;
    expect(a.busy).toBeUndefined();
    expect(a.failure?.text).toMatch(/hasn't answered yet/);
  });

  it('counts an answer whose Always allow was not saved as taken', async () => {
    const a = new Answering(env);
    await a.send('always', () => Promise.reject(problem(500, { allowNotSaved: true })));
    expect(a.done).toBe('always');
    expect(a.failure?.kind).toBe('not-saved');
  });
});
