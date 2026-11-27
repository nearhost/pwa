// Answering a request. The buttons are busy from the answer until the core answers or fails, never
// longer than the time limit, so a dropped connection never leaves them spinning; a request that
// had already ended says "already answered", one the answer ended says why, any other failure the
// problem's title.
import { ApiError } from '#lib/api/client.js';
import type { Connection } from '#lib/api/events.js';

/** How long an answer may take before the buttons are given back. */
export const answerLimit = 30_000;

export type Failure =
  /** The request had ended: answered elsewhere, expired or given up on. */
  | { kind: 'ended'; text: string }
  /** It was answered, but Always allow could not be saved. */
  | { kind: 'not-saved'; text: string }
  | { kind: 'failed'; text: string };

export const alreadyAnswered =
  'Already answered. This request ended before your answer reached it: it was answered elsewhere, it expired, or the agent stopped waiting.';

// The titles the core gives an answer to a request that was over before it came: "the request for
// port 5173 has ended: declined", "no passthrough request r1; it may have ended over 10 minutes
// ago". Any other title on an ended answer is why the answer itself failed and ended it.
const gone = /\bhas ended: |\bmay have ended\b/i;

/** What a failed answer says, from its error and the connection when it failed. */
export function failureOf(error: unknown, connection: Connection, machine: string): Failure {
  if (error instanceof ApiError) {
    const p = error.problem;
    // Answered, but Always allow could not be saved: the answer stands, whatever else it says.
    if (p.allowNotSaved) {
      return {
        kind: 'not-saved',
        text: `Answered, but Always allow wasn't saved: ${p.title}. You'll be asked again next time.`,
      };
    }
    // The core marks an answer to an ended request with `ended` and control.request-ended (409),
    // also when the answer itself failed (a passthrough that would not open) and so ended it; a 409
    // with no code is taken as the same. Another 409, such as network.off, is its own.
    if (p.ended || p.code === 'control.request-ended' || (error.status === 409 && !p.code)) {
      if (!p.title || gone.test(p.title)) return { kind: 'ended', text: alreadyAnswered };
      return { kind: 'ended', text: `This request has ended: ${p.title}` };
    }
    return { kind: 'failed', text: p.title };
  }
  if (connection === 'live') {
    return {
      kind: 'failed',
      text: `${machine} hasn't answered yet, so your answer may or may not have been taken. Answering again is safe: if it was taken, this page says so.`,
    };
  }
  return {
    kind: 'failed',
    text: `No answer from ${machine}. Try again when the connection is back.`,
  };
}

/** One request's answer: which button is busy, and what came of it. */
export class Answering {
  /** The answer being sent. */
  busy: string | undefined = $state();
  /** What the core said to the last answer, when it failed. */
  failure: Failure | undefined = $state();
  /** What the user answered, once the core took it. */
  done: string | undefined = $state();

  constructor(
    private readonly env: () => { connection: Connection; machine: string },
    private readonly limit = answerLimit,
  ) {}

  /** Sends answer with ask, unless an answer is on its way or was taken. */
  async send(answer: string, ask: () => Promise<unknown>): Promise<void> {
    if (this.busy || this.done) return;
    this.busy = answer;
    this.failure = undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), this.limit);
      });
      await Promise.race([ask(), limit]);
      this.done = answer;
    } catch (error) {
      const { connection, machine } = this.env();
      this.failure = failureOf(error, connection, machine);
      if (this.failure.kind === 'not-saved') this.done = answer;
    } finally {
      clearTimeout(timer);
      this.busy = undefined;
    }
  }
}
