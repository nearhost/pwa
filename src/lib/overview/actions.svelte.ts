// Starting and stopping projects. A project's button is busy from the ask until the core answers
// or fails, never longer than the time limit, so a dropped connection never leaves it spinning;
// what the project does next comes from the stream's events.
import { ApiError } from '#lib/api/client.js';
import { apiClient } from '#lib/state.svelte.js';

export type Action = 'start' | 'stop';

export const projectActions: {
  pending: Record<string, Action>;
  errors: Record<string, string>;
} = $state({ pending: {}, errors: {} });

/** How long an ask may take before the button is given back with an error. */
export const actionLimit = 20_000;

export async function startStop(name: string, action: Action): Promise<void> {
  if (projectActions.pending[name]) return;
  projectActions.pending[name] = action;
  delete projectActions.errors[name];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = apiClient();
    const ask =
      action === 'start'
        ? client.send('POST', '/v1/projects/{name}/start', undefined, { name })
        : client.send('POST', '/v1/projects/{name}/stop', undefined, { name });
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), actionLimit);
    });
    await Promise.race([ask, limit]);
  } catch (error) {
    projectActions.errors[name] =
      error instanceof ApiError
        ? error.problem.title
        : `No answer to ${action === 'start' ? 'start' : 'stop'} ${name}. Try again when the connection is back.`;
  } finally {
    clearTimeout(timer);
    delete projectActions.pending[name];
  }
}
