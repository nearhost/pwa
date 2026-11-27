// What waits for the user's answer, as the screens show it: agents' requests (a proposal to add a
// project or a server, a passthrough, a document) and projects' .nearhostrc changes. Sentences are
// made of segments, so a screen can show what an agent wrote as text in its own bidi isolate and
// tell it from the app's words: a string is the app's, an object is the agent's (or the config's).
import type { State } from '#lib/api/types.js';
import type { SiteRoute } from '#lib/overview/model.js';

type Schemas = import('#lib/api/types.js').components['schemas'];
export type Approval = Schemas['Approval'];
export type Proposal = Schemas['Proposal'];
export type PassRequest = Schemas['PassRequest'];
export type DocRequest = Schemas['DocRequest'];
export type Change = Schemas['Change'];
export type ChangeItem = Schemas['Item'];
export type ConfigRoute = Schemas['Route'];

/** Text the app did not write: shown as text, isolated, wrapped anywhere. */
export interface Quoted {
  text: string;
  /** A path, port or host: set in the monospace face. */
  mono?: boolean;
}
export type Segment = string | Quoted;

/** The segments as plain text, for labels and tests. */
export function plain(segments: Segment[]): string {
  return segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');
}

const q = (text: string): Quoted => ({ text });
const mono = (text: string): Quoted => ({ text, mono: true });

/** What the screens need to know besides the request. */
export interface Context {
  /** This machine's name, the core's. */
  machine: string;
  /** The servers Nearhost has. */
  servers: string[];
  /** Now, in milliseconds. */
  now: number;
}

/** The origin the core gives a request made on this machine. */
export const localOrigin = 'local';

/** The tool that asked, as people call it. */
export function requesterName(requester: string): string {
  switch (requester) {
    case 'claude-code':
      return 'Claude Code';
    case 'codex':
      return 'Codex';
    case 'agent':
    case '':
      return 'An agent';
  }
  return requester;
}

/** The machine a request came from: this machine's name, or the server's. */
export function originName(origin: string, ctx: Context): string {
  return !origin || origin === localOrigin ? ctx.machine : origin;
}

/** How long the asker still waits: "Waits 4 more minutes", or that its time is up. */
export function waitsText(expires: string, now: number): string {
  const at = Date.parse(expires);
  if (Number.isNaN(at)) return '';
  const left = at - now;
  if (left <= 0) return 'Its time is up.';
  const minutes = Math.ceil(left / 60_000);
  if (left < 60_000) return 'Waits under a minute more.';
  return `Waits ${minutes} more minute${minutes === 1 ? '' : 's'}.`;
}

/** The last part of a path, the folder's name. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? '';
}

export interface Field {
  label: string;
  value: Segment[];
}

export interface ProposalView {
  title: Segment[];
  intro: Segment[];
  fields: Field[];
  notes: Segment[][];
  /** Its origin is a server Nearhost no longer has, so it can only be declined. */
  removed: boolean;
  waits: string;
}

/**
 * An agent's proposal to add a project, on this machine (origin "local") or on a server Nearhost
 * has. An origin that is neither is a server removed while its proposal waited. The app can't add
 * projects yet (the core's accept only tells the agent it was saved), so it can only be declined
 * here; the note says where to add it.
 */
export function proposalView(p: Proposal, ctx: Context): ProposalView {
  const where = originName(p.Origin, ctx);
  const local = where === ctx.machine;
  const removed = !local && !ctx.servers.includes(p.Origin);
  const name = p.Name || baseName(p.Path);
  const fields: Field[] = [
    { label: 'Folder', value: [mono(p.Path)] },
    {
      label: 'Serves',
      value: p.Web > 0 ? [mono(`port ${p.Web}`)] : ['The port it finds when it starts'],
    },
    {
      label: 'Runs on',
      value: local
        ? [`${ctx.machine}, this machine`]
        : removed
          ? [q(where), ', which is no longer in Nearhost']
          : [q(where)],
    },
  ];
  const notes: Segment[][] = removed
    ? [
        [
          q(where),
          ' is no longer in Nearhost, so this project can’t be added. Decline it to tell the agent.',
        ],
      ]
    : [
        [
          `Adding projects from the app comes next. To add it now, use Nearhost on ${ctx.machine}, or decline it here.`,
        ],
      ];
  return {
    title: ['Add ', q(name), ' to Nearhost?'],
    intro: removed
      ? [
          'An agent, working in ',
          mono(p.Path),
          ' on ',
          q(where),
          ', which is no longer in Nearhost, asked.',
        ]
      : ['An agent, working in ', mono(p.Path), ' on ', q(where), ', asked.'],
    fields,
    notes,
    removed,
    waits: waitsText(p.Expires, ctx.now),
  };
}

export interface RequestView {
  title: string;
  intro: Segment[];
  fields: Field[];
  notes: Segment[][];
  canAlways: boolean;
  waits: string;
}

/** An agent's request to forward one of its machine's ports to this machine. */
export function passView(r: PassRequest, ctx: Context): RequestView {
  const where = originName(r.Origin, ctx);
  const intro: Segment[] = [
    q(requesterName(r.Requester)),
    ' on ',
    q(where),
    ' wants to open port ',
    mono(String(r.Remote)),
    ` on ${ctx.machine}`,
  ];
  if (r.Label) intro.push(' (', q(r.Label), ')');
  intro.push('.');
  const fields: Field[] = [
    { label: 'Port', value: [mono(String(r.Remote))] },
    { label: 'From', value: [q(where)] },
  ];
  if (r.Label) fields.push({ label: 'For', value: [q(r.Label)] });
  if (r.Session) fields.push({ label: 'Session', value: [mono(r.Session)] });
  const notes: Segment[][] = [];
  if (r.LocalTaken) {
    notes.push([`Port ${r.Remote} is in use on ${ctx.machine}, so it will open on another port.`]);
  }
  if (r.CanAlways) {
    notes.push([
      'Always allow lets ',
      q(requesterName(r.Requester)),
      ' on ',
      q(where),
      ' open more ports without asking.',
    ]);
  }
  return {
    title: `Open port ${r.Remote}?`,
    intro,
    fields,
    notes,
    canAlways: r.CanAlways,
    waits: waitsText(r.Expires, ctx.now),
  };
}

/** An agent's request to show a document, serving the folder it is in. */
export function docView(r: DocRequest, ctx: Context): RequestView {
  const where = originName(r.Origin, ctx);
  const intro: Segment[] = [
    q(requesterName(r.Requester)),
    ' on ',
    q(where),
    ' wants to show ',
    mono(r.Doc),
  ];
  if (r.Label) intro.push(' (', q(r.Label), ')');
  intro.push('.');
  const fields: Field[] = [
    { label: 'Document', value: [mono(r.Doc)] },
    { label: 'Folder', value: [mono(r.Root)] },
    { label: 'On', value: [q(where)] },
  ];
  const notes: Segment[][] = [
    ['Nearhost will serve the files in ', mono(r.Root), ', except dotfiles.'],
  ];
  if (r.CanAlways) {
    notes.push(
      r.NewRoot
        ? [
            q(requesterName(r.Requester)),
            ' has Always allow on ',
            q(where),
            ', but not for this folder. Always allow adds it.',
          ]
        : [
            'Always allow lets ',
            q(requesterName(r.Requester)),
            ' on ',
            q(where),
            ' show documents from this folder without asking.',
          ],
    );
  }
  return {
    title: 'Show a document?',
    intro,
    fields,
    notes,
    canAlways: r.CanAlways,
    waits: waitsText(r.Expires, ctx.now),
  };
}

export interface DiffLine {
  sign: '+' | '-' | ' ';
  text: string;
}

export interface ChangeView {
  sha: string;
  intro: string;
  /** What needs approval, each with why. */
  items: { what: Segment[]; why: string }[];
  /**
   * What the change serves, and what it no longer serves: + for what is surely new, - for what is
   * surely gone, ' ' for what it serves where the state can't tell whether that is new.
   */
  diff: DiffLine[];
}

/** The name of what an item asks for: its host, localhost:<port> for a loopback port, its option. */
function itemWhat(it: ChangeItem): Segment[] {
  if (it.Host) return [mono(it.Host), ` on port ${it.Port}`];
  if (it.Option === 'loopback') return [mono(`localhost:${it.Port}`)];
  if (it.Option === 'docker_clients') return ['Docker clients'];
  return [mono(it.Option)];
}

/** The web hosts a project's routes serve, with the port each goes to. */
function servedBy(routes: ConfigRoute[], alias: string): { host: string; port: number }[] {
  const out: { host: string; port: number }[] = [];
  let first = true;
  for (const r of routes) {
    if (r.Role !== 'web') continue;
    const hosts = [...(r.Hosts ?? [])];
    if (first && alias && !hosts.includes(alias)) hosts.unshift(alias);
    first = false;
    for (const host of hosts) if (host) out.push({ host, port: r.Port });
  }
  return out;
}

/**
 * The change a project's .nearhostrc asks for: what needs approval (the core's items, the main
 * content), and what it serves after, with its loopback ports.
 */
export function changeView(name: string, change: Change, current: SiteRoute[]): ChangeView {
  const next = change.Project.Routes ?? [];
  const after = servedBy(next, change.Project.Alias);
  const asked = change.Items ?? [];
  // The state has only each web route's main name now, so only what is sure is marked: a host the
  // change no longer serves at all, and a host or loopback port that is new because the change
  // adds its port or asks approval for it. Everything else it serves is listed unmarked.
  const ports = new Set(current.map((r) => r.port));
  const diff: DiffLine[] = [];
  for (const r of current) {
    if (!after.some((a) => a.host === r.host && a.port === r.port)) {
      diff.push({ sign: '-', text: `${r.host} → port ${r.port}` });
    }
  }
  for (const a of after) {
    const isNew =
      !ports.has(a.port) || asked.some((it) => it.Host === a.host && it.Port === a.port);
    diff.push({ sign: isNew ? '+' : ' ', text: `${a.host} → port ${a.port}` });
  }
  for (const r of next) {
    if (r.Role !== 'loopback') continue;
    const isNew = asked.some((it) => it.Option === 'loopback' && it.Port === r.Port);
    diff.push({
      sign: isNew ? '+' : ' ',
      text: `localhost:${r.Port} (loopback${r.Label ? `, ${r.Label}` : ''})`,
    });
  }
  const items = (change.Items ?? []).map((it) => ({ what: itemWhat(it), why: it.Why }));
  return {
    sha: change.SHA256,
    intro: `Its .nearhostrc changed. Until you approve it, ${name} keeps serving what was approved before.`,
    items,
    diff,
  };
}

/** One thing that waits, as the overview lists it. */
export interface WaitingView {
  key: string;
  href: string;
  kind: 'proposal' | 'pass' | 'doc' | 'change';
  headline: Segment[];
  detail: Segment[];
}

/** One agent's request as the list shows it; one of no kind the app knows says only that it waits. */
export function waitingView(a: Approval, ctx: Context): WaitingView {
  const href = `/approve/${encodeURIComponent(a.id)}`;
  if (a.proposal) {
    const p = a.proposal;
    const view = proposalView(p, ctx);
    const where = originName(p.Origin, ctx);
    const name = p.Name || baseName(p.Path);
    const serving = p.Web > 0 ? `, serving port ${p.Web}` : '';
    return {
      key: a.id,
      href,
      kind: 'proposal',
      headline: view.removed
        ? [
            'An agent wants to add ',
            q(name),
            ' from ',
            q(where),
            ', which is no longer in Nearhost',
          ]
        : ['An agent wants to add ', q(name), ' on ', q(where)],
      detail: ['From ', mono(p.Path), `${serving}. ${view.waits}`],
    };
  }
  if (a.pass) {
    const r = a.pass;
    const detail: Segment[] = [];
    if (r.Label) detail.push(q(r.Label), ' · ');
    detail.push(`opens on ${ctx.machine}. ${waitsText(r.Expires, ctx.now)}`);
    return {
      key: a.id,
      href,
      kind: 'pass',
      headline: [
        q(requesterName(r.Requester)),
        ' on ',
        q(originName(r.Origin, ctx)),
        ' wants to open port ',
        mono(String(r.Remote)),
      ],
      detail,
    };
  }
  if (a.doc) {
    const r = a.doc;
    return {
      key: a.id,
      href,
      kind: 'doc',
      headline: [
        q(requesterName(r.Requester)),
        ' on ',
        q(originName(r.Origin, ctx)),
        ' wants to show ',
        mono(baseName(r.Doc) || r.Doc),
      ],
      detail: ['From ', mono(r.Root), `. ${waitsText(r.Expires, ctx.now)}`],
    };
  }
  return {
    key: a.id,
    href,
    kind: 'pass',
    headline: ['A request waits for your answer'],
    detail: [],
  };
}

/** What waits for the user: agents' requests, oldest first, then projects' changes by name. */
export function waitingList(state: State | undefined, ctx: Context): WaitingView[] {
  if (!state) return [];
  const out = (state.approvals ?? []).map((a) => waitingView(a, ctx));
  const changed = Object.entries(state.projects ?? {})
    .filter(([, p]) => p.Pending)
    .map(([name, p]) => ({ name, n: p.Pending?.Items?.length ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const { name, n } of changed) {
    out.push({
      key: `change ${name}`,
      href: `/change/${encodeURIComponent(name)}`,
      kind: 'change',
      headline: [
        q(name),
        `’s .nearhostrc asks for ${n === 1 ? '1 change that needs' : `${n} changes that need`} approval`,
      ],
      detail: [`Until you approve it, `, q(name), ` keeps serving what was approved before.`],
    });
  }
  return out;
}

/** The context the screens build their views in, from the state and session. */
export function contextOf(state: State | undefined, machine: string, now: number): Context {
  return { machine, servers: Object.keys(state?.servers ?? {}), now };
}
