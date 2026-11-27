// The canvas's projects as the fake core's state: on this machine (leto) storefront with three
// routes, docs-site and a stopped admin; on the server build-box, api running and worker starting.
// The session is networked, so each route opens at its network address.
import type { Page, Route } from '@playwright/test';
import type { State } from '../src/lib/api/types.js';

type Project = NonNullable<State['projects']>[string];

export function project(state: Project['State'], extra: Partial<Project> = {}): Project {
  return {
    State: state,
    Message: '',
    Alias: '',
    WebLocalPort: 0,
    WebLocalPorts: null,
    Notice: '',
    Waiting: '',
    ...extra,
  };
}

const route = (host: string, port: number) => ({
  host: `${host}.test`,
  port,
  url: `https://${host}.test`,
  networkUrl: `https://${host}.lab.example.dev`,
});

export const canvas: Partial<State> = {
  projects: {
    storefront: project('running'),
    'docs-site': project('running'),
    admin: project('stopped'),
    api: project('running'),
    worker: project('starting', { Message: 'waiting for port 9000 to answer' }),
  },
  sites: {
    storefront: {
      routes: [
        route('storefront', 80),
        route('mail.storefront', 8025),
        route('vite.storefront', 5173),
      ],
    },
    'docs-site': { routes: [route('docs-site', 4321)] },
    admin: { routes: [route('admin', 8080)] },
    api: { server: 'build-box', routes: [route('api.build', 3000)] },
    worker: { server: 'build-box', routes: [route('worker.build', 9000)] },
  },
  servers: {
    'build-box': {
      health: {} as never,
      status: 'connected',
      message: '',
    },
  },
};

/**
 * Answers the projects' own addresses with a small page, except the hosts in hang, which never
 * answer, as a site that won't load in the frame doesn't.
 */
export async function serveSites(page: Page, opts: { hang?: string[] } = {}) {
  await page.route(/^https:\/\/[^/]*\.lab\.example\.dev\//, (r: Route) => {
    const host = new URL(r.request().url()).host;
    if (opts.hang?.includes(host)) return; // never answered
    return r.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><title>${host}</title><h1>${host}</h1>`,
    });
  });
}

type Approval = NonNullable<State['approvals']>[number];
type Change = NonNullable<Project['Pending']>;

// Ten minutes from when the tests start: well inside every request's wait.
const expires = new Date(Date.now() + 10 * 60_000).toISOString();

/** Requests that wait for the user, as the core's state lists them. */
export const requests = {
  /** An agent's proposal to add billing on this machine, serving port 8000. */
  proposal: (id: string, extra: Partial<NonNullable<Approval['proposal']>> = {}): Approval => ({
    id,
    proposal: {
      ID: id,
      Origin: 'local',
      Path: '/home/ecs/Code/billing',
      Name: 'billing',
      Web: 8000,
      Expires: expires,
      ...extra,
    },
  }),
  /** Claude Code on build-box asking to open its port 5173, for vite. */
  pass: (id: string, extra: Partial<NonNullable<Approval['pass']>> = {}): Approval => ({
    id,
    pass: {
      ID: id,
      Origin: 'build-box',
      Requester: 'claude-code',
      Session: '',
      Label: 'vite',
      Remote: 5173,
      LocalTaken: false,
      CanAlways: true,
      Expires: expires,
      ...extra,
    },
  }),
  /** Codex on this machine asking to show plans/checkout.md. */
  doc: (id: string, extra: Partial<NonNullable<Approval['doc']>> = {}): Approval => ({
    id,
    doc: {
      ID: id,
      Origin: 'local',
      Requester: 'codex',
      Session: '',
      Label: 'the plan',
      Root: '/home/ecs/Code/shop/docs',
      Doc: 'plans/checkout.md',
      CanAlways: true,
      NewRoot: false,
      Expires: expires,
      ...extra,
    },
  }),
  /** storefront's .nearhostrc asking to serve shop.com and to bind localhost:3306. */
  change: {
    SHA256: 'abc123',
    Project: {
      Name: 'storefront',
      Server: '',
      Path: '/home/ecs/Code/storefront',
      Alias: 'storefront.test',
      Enabled: true,
      Routes: [
        { Port: 80, Role: 'web', Label: '', Hosts: ['shop.com'] },
        { Port: 3306, Role: 'loopback', Label: 'mysql', Hosts: null },
      ],
    },
    Items: [
      { Port: 80, Host: 'shop.com', Why: 'a real domain', Option: '' },
      { Port: 3306, Host: '', Why: 'binds localhost on this machine', Option: 'loopback' },
    ],
  } satisfies Change as Change,
};
