// When the offline view takes the place of the screen, and what it remembers of the machine. The
// view comes at once when the core hasn't answered since the app loaded (a shell from the cache,
// or a core that is down), and after lostLong of a lost connection otherwise: a short drop keeps
// the screen, which says how old it is. It stays while Try again is connecting, and goes once the
// connection is live again.
import type { Connection } from '#lib/api/events.js';

/** How long a lost connection keeps the screen it had before the offline view replaces it. */
export const lostLong = 10_000;

export interface OfflineInput {
  connection: Connection;
  /** When the connection was first lost since it was last live; undefined while it isn't. */
  lostSince: number | undefined;
  /** Whether the core has answered anything since the app loaded. */
  answered: boolean;
  now: number;
}

export function showOffline({ connection, lostSince, answered, now }: OfflineInput): boolean {
  if (connection === 'live' || connection === 'signed-out') return false;
  if (lostSince === undefined) return false;
  return !answered || now - lostSince >= lostLong;
}

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayAndTime = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** When the core last answered, as "Last answered at …" says it: the time, and the day if not today. */
export function answeredAt(at: Date, now: Date): string {
  const today =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  return (today ? time : dayAndTime).format(at);
}

/** The machine that last answered this device, and when, kept so a shell from the cache can say. */
export interface LastSeen {
  machine: string;
  at: Date;
}

const key = 'nearhost.lastAnswered';

export function readLastSeen(): LastSeen | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { machine?: unknown; at?: unknown };
    if (typeof parsed.machine !== 'string' || typeof parsed.at !== 'string') return undefined;
    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) return undefined;
    return { machine: parsed.machine, at };
  } catch {
    return undefined;
  }
}

export function writeLastSeen(seen: LastSeen) {
  try {
    localStorage.setItem(key, JSON.stringify({ machine: seen.machine, at: seen.at.toISOString() }));
  } catch {
    // Not kept: a shell from the cache then says "this machine" and gives no time.
  }
}
