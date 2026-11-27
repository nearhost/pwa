// Each project's recent log lines, from the stream's events with that project and no state. The
// layout starts it with the app, so a preview opened later still has the lines before it.
import type { Envelope } from '#lib/api/types.js';
import { followEnvelopes } from '#lib/state.svelte.js';

export function createLogs(limit = 200) {
  const byProject: Record<string, string[]> = $state({});
  return {
    take(envelope: Envelope) {
      const event = envelope.kind === 'event' ? envelope.event : undefined;
      if (!event?.Project || event.State) return;
      const lines = byProject[event.Project] ?? [];
      lines.push(event.Message);
      if (lines.length > limit) lines.splice(0, lines.length - limit);
      byProject[event.Project] = lines;
    },
    lines(project: string): string[] {
      return byProject[project] ?? [];
    },
  };
}

export const projectLogs = createLogs();

export function startLogs(): () => void {
  return followEnvelopes((envelope) => projectLogs.take(envelope));
}
