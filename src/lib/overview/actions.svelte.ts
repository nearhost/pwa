// Starting and stopping projects. A project's button is busy from the ask until the core answers
// or fails, never longer than the time limit, so a dropped connection never leaves it spinning;
// what the project does next comes from the stream's events. An error stands until the project's
// state changes.
import { ApiError } from '#lib/api/client.js';
import type { EngineState } from './model.js';
import { apiClient, appState } from '#lib/state.svelte.js';

export type Action = 'start' | 'stop';

interface ActionError {
  text: string;
  /** The project's state when the ask was made; another state means the error is old news. */
  state: EngineState;
}

export const projectActions: {
  pending: Record<string, Action>;
  errors: Record<string, ActionError>;
} = $state({ pending: {}, errors: {} });

/** How long an ask may take before the button is given back with an error. */
export const actionLimit = 20_000;

/** The error of the last ask for name, while the project is still in the state it was asked in. */
export function actionError(name: string, state: EngineState): string | undefined {
  const error = projectActions.errors[name];
  return error && error.state === state ? error.text : undefined;
}

export async function startStop(name: string, action: Action, state: EngineState): Promise<void> {
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
    let text: string;
    if (error instanceof ApiError) text = error.problem.title;
    else if (appState.connection === 'live') {
      const machine = appState.session?.machine || 'This machine';
      text = `${machine} hasn't answered yet. ${name} may still ${action}; its state shows here when it does.`;
    } else text = `No answer to ${action} ${name}. Try again when the connection is back.`;
    projectActions.errors[name] = { text, state };
  } finally {
    clearTimeout(timer);
    delete projectActions.pending[name];
  }
}
