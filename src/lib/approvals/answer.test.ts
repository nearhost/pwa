import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '#lib/api/client.js';
import { alreadyAnswered, Answering, failureOf } from './answer.svelte.js';

const problem = (status: number, extra: object = {}) =>
  new ApiError(status, { error: 'Refused', title: 'Refused', status, ...extra });

describe('a failed answer', () => {
  it('to a request that had ended says already answered', () => {
    const ended = (title: string) =>
      failureOf(
        problem(409, { ended: true, code: 'control.request-ended', title }),
        'live',
        'leto',
      );
    expect(ended('the request for port 5173 has ended: declined')).toEqual({
      kind: 'ended',
      text: alreadyAnswered,
    });
    expect(ended('no passthrough request r1; it may have ended over 10 minutes ago').text).toBe(
      alreadyAnswered,
    );
    expect(failureOf(problem(409, { title: '' }), 'live', 'leto').text).toBe(alreadyAnswered);
  });

  it('that ended the request itself says why, not already answered', () => {
    // A Yes whose passthrough would not open: the core ends the request and answers 409 ended.
    const f = failureOf(
      problem(409, {
        ended: true,
        code: 'control.request-ended',
        title: 'build-box isn’t connected',
      }),
      'live',
      'leto',
    );
    expect(f).toEqual({ kind: 'ended', text: 'This request has ended: build-box isn’t connected' });
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

  it("says when Always allow wasn't saved, though the answer was taken, also on an ended one", () => {
    const text =
      "Answered, but Always allow wasn't saved: disk full. You'll be asked again next time.";
    expect(
      failureOf(problem(500, { allowNotSaved: true, title: 'disk full' }), 'live', 'leto'),
    ).toEqual({ kind: 'not-saved', text });
    expect(
      failureOf(
        problem(409, { allowNotSaved: true, ended: true, title: 'disk full' }),
        'live',
        'leto',
      ),
    ).toEqual({ kind: 'not-saved', text });
  });

  it('with no answer blames the connection only when it is not live', () => {
    expect(failureOf(new Error('timeout'), 'live', 'leto').text).toBe(
      "leto hasn't answered yet, so your answer may or may not have been taken. Answering again is safe: if it was taken, this page says so.",
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
