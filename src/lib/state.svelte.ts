// What the app knows of the core, kept live: the session, the state and how the connection is.
// The root layout starts it on mount and stops it on destroy.
import type { Client } from '#lib/api/client.js';
import { openEvents, type Connection, type EventsOptions } from '#lib/api/events.js';
import type { Envelope, Session, State } from '#lib/api/types.js';

export type { Connection };

export interface AppState {
  connection: Connection;
  state?: State;
  session?: Session;
  /** When the core last answered anything successfully. */
  lastAnswered?: Date;
}

export const appState: AppState = $state({ connection: 'connecting' });

export function startState(
  client: Client,
  opts: { EventSource?: EventsOptions['EventSource'] } = {},
): () => void {
  appState.connection = 'connecting';
  appState.state = undefined;
  appState.session = undefined;
  appState.lastAnswered = undefined;

  const controller = new AbortController();
  const { signal } = controller;
  const answered = () => {
    // A new Date each time, never one changed in place, so a plain Date is reactive enough.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    if (!signal.aborted) appState.lastAnswered = new Date();
  };
  const stopObserving = client.observe({
    answered,
    signedOut: () => {
      if (!signal.aborted) appState.connection = 'signed-out';
    },
  });

  const readSession = () =>
    client.session().then(
      (session) => {
        if (!signal.aborted) appState.session = session;
      },
      () => {
        // A 401 says signed out through the observer; anything else, the stream finds too.
      },
    );
  void readSession();

  openEvents({
    client,
    signal,
    EventSource: opts.EventSource,
    onState(state) {
      appState.state = state;
      if (!appState.session) void readSession();
    },
    onEnvelope(envelope) {
      answered();
      if (appState.state) applyEnvelope(appState.state, envelope);
    },
    onStatus(status) {
      if (status === 'live') answered();
      appState.connection = status;
    },
  });

  return () => {
    controller.abort();
    stopObserving();
  };
}

/**
 * Brings state up to date with envelope, which comes next after it. The screens that need more of
 * an envelope (logs, opened passthroughs, shown documents) take it as they come.
 */
export function applyEnvelope(state: State, envelope: Envelope): void {
  state.seq = envelope.seq;
  switch (envelope.kind) {
    case 'approval': {
      const approval = envelope.approval;
      if (!approval) break;
      const approvals = (state.approvals ?? []).filter((a) => a.id !== approval.id);
      state.approvals = [...approvals, approval];
      break;
    }
    case 'ended':
      state.approvals = (state.approvals ?? []).filter((a) => a.id !== envelope.id);
      break;
    case 'event': {
      const event = envelope.event;
      const project = event?.Project ? state.projects?.[event.Project] : undefined;
      if (project && event?.State) project.State = event.State;
      break;
    }
  }
}
