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

/** What a follower of the stream is told with each envelope. */
export interface EnvelopeInfo {
  /** The state already included it when it came, so it changed nothing there. */
  inState: boolean;
}

type Follower = (envelope: Envelope, info: EnvelopeInfo) => void;

// Who follows the stream is not state anything renders.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const followers = new Set<Follower>();

/**
 * Calls follower with each envelope the stream delivers, in order, once, after the state has taken
 * it in: log lines, opened passthroughs and shown documents included. Resets are not delivered (the
 * state read they lead to is the news). A follower that throws is logged and skipped, so one
 * screen's bug neither stops the others nor the stream. Until the returned function is called.
 */
export function followEnvelopes(follower: Follower): () => void {
  followers.add(follower);
  return () => void followers.delete(follower);
}

let current: Client | undefined;
// Ends the running state's stream and reads, leaving what it has.
let endState: (() => void) | undefined;

/**
 * Says this device is signed out, as after it was unpaired, and stops following the core: every
 * request would be answered 401 now. Pairing again loads the app afresh.
 */
export function signOut() {
  appState.connection = 'signed-out';
  endState?.();
}

/** The client the running state talks to the core with; screens send their writes through it. */
export function apiClient(): Client {
  if (!current) throw new Error('the app state has not been started');
  return current;
}

export function startState(
  client: Client,
  opts: { EventSource?: EventsOptions['EventSource'] } = {},
): () => void {
  current = client;
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
  // A 401 to any request means this device isn't signed in: say so, and stop the stream, whose
  // drop would otherwise say lost and try again.
  const stopObserving = client.observe({
    answered,
    signedOut: () => {
      if (!signal.aborted) signOut();
    },
  });
  endState = () => controller.abort();

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
    onEnvelope(envelope, info) {
      answered();
      // One the state already includes changes nothing there; without a state, read it.
      let again = false;
      if (!info.inState) again = appState.state ? applyEnvelope(appState.state, envelope) : true;
      for (const follower of followers) {
        try {
          follower(envelope, info);
        } catch (error) {
          console.error('a follower of the event stream failed', error);
        }
      }
      return again;
    },
    onStatus(status) {
      if (status === 'live') answered();
      appState.connection = status;
    },
  });

  return () => {
    controller.abort();
    stopObserving();
    if (current === client) endState = undefined;
  };
}

/**
 * Brings state up to date with envelope, which comes next after it, and says whether the state
 * must be read again for the rest: an envelope applied in part (an approval, its end), one that
 * carries no state (a passthrough opened, a document shown, a config applied), a server's event
 * (the state of a server's connection is not in its events) and a state change of a project the
 * state does not have yet. The screens that need more of an envelope (logs, opened passthroughs,
 * shown documents) take it as they come.
 */
export function applyEnvelope(state: State, envelope: Envelope): boolean {
  state.seq = envelope.seq;
  switch (envelope.kind) {
    case 'approval': {
      const approval = envelope.approval;
      if (approval) {
        const approvals = (state.approvals ?? []).filter((a) => a.id !== approval.id);
        state.approvals = [...approvals, approval];
      }
      return true;
    }
    case 'ended':
      state.approvals = (state.approvals ?? []).filter((a) => a.id !== envelope.id);
      return true;
    case 'opened':
    case 'shown':
    case 'config':
      return true;
    case 'event':
      return envelope.event ? applyEvent(state, envelope.event) : false;
    default:
      return false;
  }
}

type EngineEvent = NonNullable<Envelope['event']>;

function applyEvent(state: State, event: EngineEvent): boolean {
  // A server's event, or the proxy's own: what it changed is only in the state.
  if (!event.Project) return true;
  // A project's log line leaves its state alone.
  if (!event.State) return false;
  const project = state.projects?.[event.Project];
  if (!project) return true;
  project.State = event.State;
  project.Message = reasonOf(event);
  project.Problem = event.Report ?? null;
  return false;
}

// The reason in a state change's message, "state: <state>: <reason>"; "" when it gives none.
function reasonOf(event: EngineEvent): string {
  const prefix = `state: ${event.State}`;
  if (event.Message === prefix) return '';
  if (event.Message.startsWith(`${prefix}: `)) return event.Message.slice(prefix.length + 2);
  return event.Report?.title ?? '';
}
