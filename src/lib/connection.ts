// What the screens say when the connection to the core is not live: why the data may be old and
// why actions are off. Never shown while live.
import type { Connection } from '#lib/api/events.js';

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function connectionReason(
  connection: Connection,
  machine: string,
  lastAnswered: Date | undefined,
  /** What waits for the connection, in lower case: "starting and stopping" unless said. */
  waits = 'starting and stopping',
): string | undefined {
  const Waits = waits.charAt(0).toUpperCase() + waits.slice(1);
  switch (connection) {
    case 'live':
      return undefined;
    case 'connecting':
      return `Connecting to ${machine}. ${Waits} waits until it answers.`;
    case 'lost':
      return lastAnswered
        ? `Can't reach ${machine}. This is what it said at ${time.format(lastAnswered)}; ${waits} waits until it's back.`
        : `Can't reach ${machine}. ${Waits} waits until it's back.`;
    case 'signed-out':
      return `This device isn't paired with ${machine}, so nothing here can be changed.`;
  }
}
