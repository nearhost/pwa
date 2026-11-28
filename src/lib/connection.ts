// What the screens say when the connection to the core is not live: why the data may be old and
// why actions are off. Never shown while live.
import type { Connection } from '#lib/api/events.js';

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function connectionReason(
  connection: Connection,
  machine: string,
  lastAnswered: Date | undefined,
): string | undefined {
  switch (connection) {
    case 'live':
      return undefined;
    case 'connecting':
      return `Connecting to ${machine}. Starting and stopping waits until it answers.`;
    case 'lost':
      return lastAnswered
        ? `Can't reach ${machine}. This is what it said at ${time.format(lastAnswered)}; starting and stopping waits until it's back.`
        : `Can't reach ${machine}. Starting and stopping waits until it's back.`;
    case 'signed-out':
      return `This device isn't paired with ${machine}, so nothing here can be changed.`;
  }
}
