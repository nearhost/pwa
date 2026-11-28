import { describe, expect, it } from 'vitest';
import { state } from '#lib/api/testing.js';
import type { State } from '#lib/api/types.js';
import {
  baseName,
  changeView,
  contextOf,
  docView,
  originName,
  passView,
  plain,
  proposalView,
  requesterName,
  waitingList,
  waitsText,
  type Change,
  type DocRequest,
  type PassRequest,
  type Proposal,
} from './model.js';

const now = Date.parse('2026-11-27T12:00:00Z');
const inMinutes = (m: number) => new Date(now + m * 60_000).toISOString();
const ctx = { machine: 'leto', servers: ['build-box'], now };

const proposal = (p: Partial<Proposal> = {}): Proposal => ({
  ID: 'p1',
  Origin: 'local',
  Path: '/home/ecs/Code/billing',
  Name: 'billing',
  Web: 8000,
  Expires: inMinutes(4),
  ...p,
});

const pass = (p: Partial<PassRequest> = {}): PassRequest => ({
  ID: 'r1',
  Origin: 'build-box',
  Requester: 'claude-code',
  Session: '',
  Label: 'vite',
  Remote: 5173,
  LocalTaken: false,
  CanAlways: true,
  Expires: inMinutes(2),
  ...p,
});

const doc = (p: Partial<DocRequest> = {}): DocRequest => ({
  ID: 'd1',
  Origin: 'local',
  Requester: 'codex',
  Session: '',
  Label: 'the plan',
  Root: '/home/ecs/Code/shop/docs',
  Doc: 'plans/checkout.md',
  CanAlways: true,
  NewRoot: false,
  Expires: inMinutes(1),
  ...p,
});

describe('words', () => {
  it('names the tools people know, and an unknown one as an agent', () => {
    expect(requesterName('claude-code')).toBe('Claude Code');
    expect(requesterName('codex')).toBe('Codex');
    expect(requesterName('agent')).toBe('An agent');
    expect(requesterName('aider')).toBe('aider');
  });

  it("names a request's machine: this one for local or none, else the server", () => {
    expect(originName('local', ctx)).toBe('leto');
    expect(originName('', ctx)).toBe('leto');
    expect(originName(undefined as unknown as string, ctx)).toBe('leto');
    expect(originName('build-box', ctx)).toBe('build-box');
  });

  it('says how long the asker still waits', () => {
    expect(waitsText(inMinutes(4), now)).toBe('Waits 4 more minutes.');
    expect(waitsText(inMinutes(0.9), now)).toBe('Waits under a minute more.');
    expect(waitsText(inMinutes(1.2), now)).toBe('Waits 2 more minutes.');
    expect(waitsText(inMinutes(-1), now)).toBe('Its time is up.');
    expect(waitsText('not a time', now)).toBe('');
  });

  it("takes a folder's name from a path of either kind", () => {
    expect(baseName('/home/ecs/Code/billing/')).toBe('billing');
    expect(baseName('C:\\Users\\ecs\\shop')).toBe('shop');
    expect(baseName('')).toBe('');
  });
});

describe('a proposal', () => {
  it('on this machine shows what it asks, and that the app can only decline it yet', () => {
    const v = proposalView(proposal(), ctx);
    expect(v.removed).toBe(false);
    expect(plain(v.title)).toBe('Add billing to Nearhost?');
    expect(plain(v.intro)).toBe('An agent, working in /home/ecs/Code/billing on leto, asked.');
    expect(v.fields.map((f) => [f.label, plain(f.value)])).toEqual([
      ['Folder', '/home/ecs/Code/billing'],
      ['Serves', 'port 8000'],
      ['Runs on', 'leto, this machine'],
    ]);
    expect(v.notes.map(plain)).toEqual([
      'Adding projects from the app comes next. To add it now, use Nearhost on leto, or decline it here.',
    ]);
    expect(v.waits).toBe('Waits 4 more minutes.');
  });

  it('says where to add it when the core gives no machine name', () => {
    const v = proposalView(proposal(), { ...ctx, machine: 'this machine' });
    expect(plain(v.notes[0])).toBe(
      'Adding projects from the app comes next. To add it now, use Nearhost on this machine, or decline it here.',
    );
  });

  it('left to discovery is named after its folder, its port found when it starts', () => {
    const v = proposalView(proposal({ Name: '', Web: 0 }), ctx);
    expect(plain(v.title)).toBe('Add billing to Nearhost?');
    expect(plain(v.fields[1].value)).toBe('The port it finds when it starts');
  });

  it('on a server Nearhost has is a project there', () => {
    const v = proposalView(proposal({ Origin: 'build-box', Name: 'api' }), ctx);
    expect(v.removed).toBe(false);
    expect(plain(v.intro)).toBe('An agent, working in /home/ecs/Code/billing on build-box, asked.');
  });

  it('from a server no longer in Nearhost says so, and can only be declined', () => {
    const v = proposalView(proposal({ Origin: 'mini', Name: 'api' }), ctx);
    expect(v.removed).toBe(true);
    expect(plain(v.intro)).toBe(
      'An agent, working in /home/ecs/Code/billing on mini, which is no longer in Nearhost, asked.',
    );
    expect(plain(v.fields[2].value)).toBe('mini, which is no longer in Nearhost');
    expect(v.notes.map(plain)).toEqual([
      'mini is no longer in Nearhost, so this project can’t be added. Decline it to tell the agent.',
    ]);
  });

  it("keeps what the agent wrote apart from the app's words", () => {
    const v = proposalView(proposal({ Name: '<img src=x onerror=alert(1)>' }), ctx);
    expect(v.title[1]).toEqual({ text: '<img src=x onerror=alert(1)>' });
  });
});

describe('a passthrough request', () => {
  it('says who asks for which port, from where, and offers Always allow when it may', () => {
    const v = passView(pass(), ctx);
    expect(v.title).toBe('Open port 5173?');
    expect(plain(v.intro)).toBe('Claude Code on build-box wants to open port 5173 on leto (vite).');
    expect(v.fields.map((f) => [f.label, plain(f.value)])).toEqual([
      ['Port', '5173'],
      ['From', 'build-box'],
      ['For', 'vite'],
    ]);
    expect(v.canAlways).toBe(true);
    expect(v.notes.map(plain)).toEqual([
      'Always allow lets Claude Code on build-box open more ports without asking.',
    ]);
  });

  it('says when the port is taken here, and never offers Always allow to an unknown tool', () => {
    const v = passView(
      pass({ LocalTaken: true, CanAlways: false, Requester: 'agent', Label: '' }),
      ctx,
    );
    expect(plain(v.intro)).toBe('An agent on build-box wants to open port 5173 on leto.');
    expect(v.canAlways).toBe(false);
    expect(v.notes.map(plain)).toEqual([
      'Port 5173 is in use on leto, so it will open on another port.',
    ]);
  });
});

describe('a document request', () => {
  it('says which document and the folder that will be served', () => {
    const v = docView(doc(), ctx);
    expect(v.title).toBe('Show a document?');
    expect(plain(v.intro)).toBe('Codex on leto wants to show plans/checkout.md (the plan).');
    expect(v.fields.map((f) => [f.label, plain(f.value)])).toEqual([
      ['Document', 'plans/checkout.md'],
      ['Folder', '/home/ecs/Code/shop/docs'],
      ['On', 'leto'],
    ]);
    expect(v.notes.map(plain)).toEqual([
      'Nearhost will serve the files in /home/ecs/Code/shop/docs, except dotfiles.',
      'Always allow lets Codex on leto show documents from this folder without asking.',
    ]);
  });

  it('says Always allow adds a new folder to a grant the requester has', () => {
    const v = docView(doc({ NewRoot: true }), ctx);
    expect(plain(v.notes[1])).toBe(
      'Codex has Always allow on leto, but not for this folder. Always allow adds it.',
    );
  });
});

describe("a project's change", () => {
  const change: Change = {
    SHA256: 'abc',
    Project: {
      Name: 'shop',
      Server: '',
      Path: '/p',
      Alias: 'shop.test',
      Enabled: true,
      Routes: [
        { Port: 80, Role: 'web', Label: '', Hosts: ['shop.com'] },
        { Port: 8025, Role: 'web', Label: 'mail', Hosts: ['mail.shop.test'] },
        { Port: 3306, Role: 'loopback', Label: 'mysql', Hosts: null },
        { Port: 9000, Role: 'ignore', Label: '', Hosts: null },
      ],
    },
    Items: [
      { Port: 80, Host: 'shop.com', Why: 'a real domain', Option: '' },
      { Port: 3306, Host: '', Why: 'binds localhost on this machine', Option: 'loopback' },
      { Port: 0, Host: '', Why: 'opens the project to containers', Option: 'docker_clients' },
    ],
  };
  const current = [
    { host: 'shop.test', port: 80, url: 'https://shop.test' },
    { host: 'vite.shop.test', port: 5173, url: 'https://vite.shop.test' },
  ];

  it('lists what needs approval and why', () => {
    const v = changeView('shop', change, current);
    expect(v.sha).toBe('abc');
    expect(v.items.map((i) => [plain(i.what), i.why])).toEqual([
      ['shop.com on port 80', 'a real domain'],
      ['localhost:3306', 'binds localhost on this machine'],
      ['Docker clients', 'opens the project to containers'],
    ]);
    expect(v.intro).toBe(
      'Its .nearhostrc changed. Until you approve it, shop keeps serving what was approved before.',
    );
  });

  it('marks only what is sure: hosts no longer served, and new ports or approved hosts', () => {
    expect(changeView('shop', change, current).diff).toEqual([
      { sign: '-', text: 'vite.shop.test → port 5173' },
      { sign: ' ', text: 'shop.test → port 80' },
      { sign: '+', text: 'shop.com → port 80' },
      { sign: '+', text: 'mail.shop.test → port 8025' },
      { sign: '+', text: 'localhost:3306 (loopback, mysql)' },
    ]);
  });

  it("leaves unmarked what the state can't tell is new: another host on a port served now", () => {
    const quiet = {
      ...change,
      Project: {
        ...change.Project,
        Routes: [
          { Port: 80, Role: 'web' as const, Label: '', Hosts: ['www.shop.test'] },
          { Port: 3307, Role: 'loopback' as const, Label: '', Hosts: null },
        ],
      },
      Items: [],
    };
    expect(changeView('shop', quiet, current.slice(0, 1)).diff).toEqual([
      { sign: ' ', text: 'shop.test → port 80' },
      { sign: ' ', text: 'www.shop.test → port 80' },
      { sign: ' ', text: 'localhost:3307 (loopback)' },
    ]);
  });
});

describe('what waits', () => {
  const p = (extra: object = {}) =>
    ({
      State: 'running',
      Message: '',
      Alias: '',
      WebLocalPort: 0,
      WebLocalPorts: null,
      Notice: '',
      Waiting: '',
      ...extra,
    }) as NonNullable<State['projects']>[string];

  it("lists agents' requests oldest first, then projects' changes by name", () => {
    const s = state(1, {
      approvals: [
        { id: 'a1', proposal: proposal() },
        { id: 'a2', pass: pass() },
        { id: 'a3', doc: doc() },
        { id: 'a4', proposal: proposal({ Origin: 'mini', Name: 'api' }) },
      ],
      projects: {
        shop: p({ Pending: { SHA256: 'x', Items: [{}, {}] } }),
        blog: p({ Pending: { SHA256: 'y', Items: [{}] } }),
        docs: p(),
      },
      servers: { 'build-box': {} as never },
    });
    const list = waitingList(s, contextOf(s, 'leto', now));
    expect(list.map((w) => [w.key, w.href, w.kind, plain(w.headline), plain(w.detail)])).toEqual([
      [
        'a1',
        '/approve/a1',
        'proposal',
        'An agent wants to add billing on leto',
        'From /home/ecs/Code/billing, serving port 8000. Waits 4 more minutes.',
      ],
      [
        'a2',
        '/approve/a2',
        'pass',
        'Claude Code on build-box wants to open port 5173',
        'vite · opens on leto. Waits 2 more minutes.',
      ],
      [
        'a3',
        '/approve/a3',
        'doc',
        'Codex on leto wants to show checkout.md',
        'From /home/ecs/Code/shop/docs. Waits 1 more minute.',
      ],
      [
        'a4',
        '/approve/a4',
        'proposal',
        'An agent wants to add api from mini, which is no longer in Nearhost',
        'From /home/ecs/Code/billing, serving port 8000. Waits 4 more minutes.',
      ],
      [
        'change blog',
        '/change/blog',
        'change',
        'blog’s .nearhostrc asks for 1 change that needs approval',
        'Until you approve it, blog keeps serving what was approved before.',
      ],
      [
        'change shop',
        '/change/shop',
        'change',
        'shop’s .nearhostrc asks for 2 changes that need approval',
        'Until you approve it, shop keeps serving what was approved before.',
      ],
    ]);
  });

  it('links an id that needs escaping safely', () => {
    const s = state(1, { approvals: [{ id: 'a/b c', pass: pass() }] });
    expect(waitingList(s, ctx)[0].href).toBe('/approve/a%2Fb%20c');
  });

  it('is empty before the state', () => {
    expect(waitingList(undefined, ctx)).toEqual([]);
  });
});
