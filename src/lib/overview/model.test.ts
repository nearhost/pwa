import { describe, expect, it } from 'vitest';
import { state } from '#lib/api/testing.js';
import type { State } from '#lib/api/types.js';
import {
  addressOf,
  documentCount,
  filterGroups,
  groupByMachine,
  previewLink,
  stateLabel,
  waitingCount,
  waitingItems,
} from './model.js';

type Project = NonNullable<State['projects']>[string];
type Site = NonNullable<State['sites']>[string];

function project(State: Project['State'], extra: Partial<Project> = {}): Project {
  return {
    State,
    Message: '',
    Alias: '',
    WebLocalPort: 0,
    WebLocalPorts: null,
    Notice: '',
    Waiting: '',
    ...extra,
  };
}

function site(host: string, server?: string, networkUrl?: string): Site {
  return {
    ...(server ? { server } : {}),
    routes: [{ host, port: 80, url: `https://${host}`, ...(networkUrl ? { networkUrl } : {}) }],
  };
}

const fixture = state(3, {
  projects: {
    storefront: project('running'),
    admin: project('stopped'),
    api: project('running'),
    worker: project('starting', { Message: 'waiting for port 9000 to answer' }),
    docs: project('running'),
  },
  sites: {
    storefront: site('storefront.test'),
    admin: site('admin.test'),
    api: site('api.test', 'build-box'),
    worker: site('worker.test', 'build-box'),
    docs: site('docs.test', 'artemis'),
  },
  servers: {},
});

describe('groupByMachine', () => {
  it('puts this machine first, named for it, then each server by name', () => {
    const groups = groupByMachine(fixture, 'leto');
    expect(groups.map((g) => [g.name, g.local, g.projects.map((p) => p.name)])).toEqual([
      ['leto', true, ['admin', 'storefront']],
      ['artemis', false, ['docs']],
      ['build-box', false, ['api', 'worker']],
    ]);
  });

  it('counts what runs in each group', () => {
    const groups = groupByMachine(fixture, 'leto');
    expect(groups.map((g) => g.running)).toEqual([1, 1, 1]);
  });

  it('calls this machine "This machine" when the core gives no name', () => {
    expect(groupByMachine(fixture, '')[0].name).toBe('This machine');
  });

  it('keeps a project with no site on this machine, and its primary route undefined', () => {
    const s = state(1, { projects: { bare: project('stopped') }, sites: {} });
    const [local] = groupByMachine(s, 'leto');
    expect(local.projects[0].name).toBe('bare');
    expect(local.projects[0].primary).toBeUndefined();
  });

  it('has no groups when nothing is served', () => {
    expect(groupByMachine(state(1, { projects: null, sites: null }), 'leto')).toEqual([]);
  });
});

describe('filterGroups', () => {
  const groups = groupByMachine(fixture, 'leto');

  it('keeps the projects whose name has the text, ignoring case and spaces around it', () => {
    const found = filterGroups(groups, '  OR ');
    expect(found.map((g) => [g.name, g.projects.map((p) => p.name)])).toEqual([
      ['leto', ['storefront']],
      ['build-box', ['worker']],
    ]);
  });

  it('keeps everything for an empty search', () => {
    expect(filterGroups(groups, '')).toBe(groups);
    expect(filterGroups(groups, '   ')).toBe(groups);
  });

  it('drops every group when nothing matches', () => {
    expect(filterGroups(groups, 'zzz')).toEqual([]);
  });
});

describe('addressOf', () => {
  const route = {
    host: 'shop.test',
    port: 80,
    url: 'https://shop.test',
    networkUrl: 'https://shop.lab.example.dev',
  };

  it('is the network address on a networked core', () => {
    expect(addressOf(route, true)).toBe('https://shop.lab.example.dev');
  });

  it('is the local address on a core that does not serve the network', () => {
    expect(addressOf(route, false)).toBe('https://shop.test');
  });

  it('is the local address when the route has no network address', () => {
    expect(addressOf({ ...route, networkUrl: undefined }, true)).toBe('https://shop.test');
  });

  it('is undefined without a route', () => {
    expect(addressOf(undefined, true)).toBeUndefined();
  });
});

describe('previewLink', () => {
  const address = 'https://shop.lab.example.dev';

  it('opens the preview in the app by default', () => {
    expect(previewLink('shop', address, { openIn: 'app', always: false })).toEqual({
      href: '/projects/shop',
      browser: false,
    });
  });

  it('escapes the name in the path', () => {
    expect(previewLink('my shop', address, { openIn: 'app', always: false }).href).toBe(
      '/projects/my%20shop',
    );
  });

  it('opens in the browser when the device says so', () => {
    expect(previewLink('shop', address, { openIn: 'browser', always: false })).toEqual({
      href: address,
      browser: true,
    });
  });

  it('opens in the browser when the project is always opened there', () => {
    expect(previewLink('shop', address, { openIn: 'app', always: true })).toEqual({
      href: address,
      browser: true,
    });
  });

  it('stays in the app when there is no address to open', () => {
    expect(previewLink('shop', undefined, { openIn: 'browser', always: true }).browser).toBe(false);
  });
});

describe('labels and counts', () => {
  it('names each state in a word', () => {
    expect(
      ['running', 'starting', 'stopped', 'error', 'degraded'].map((s) =>
        stateLabel(s as Project['State']),
      ),
    ).toEqual(['Running', 'Starting', 'Stopped', 'Error', 'Degraded']);
  });

  it("counts what waits: the approvals and the projects' changes", () => {
    const s = state(1, {
      approvals: [{ id: 'a1' }, { id: 'a2' }] as State['approvals'],
      projects: {
        shop: project('running', { Pending: { SHA256: 'x' } as Project['Pending'] }),
        blog: project('running'),
      },
    });
    expect(waitingCount(s)).toBe(3);
    expect(waitingCount(undefined)).toBe(0);
  });

  it('lists what waits, each with where it is answered', () => {
    const s = state(1, {
      approvals: [
        { id: 'a1', proposal: { Name: 'billing', Origin: 'leto' } },
        { id: 'a2', pass: { Requester: 'claude-code', Remote: 5173 } },
        { id: 'a3', doc: { Requester: 'codex', Root: '~/Code/x' } },
      ] as State['approvals'],
      projects: { shop: project('running', { Pending: { SHA256: 'x' } as Project['Pending'] }) },
    });
    expect(waitingItems(s)).toEqual([
      { key: 'a1', text: 'An agent wants to add billing', href: '/approve/a1' },
      { key: 'a2', text: 'claude-code asks to open port 5173', href: '/approve/a2' },
      { key: 'a3', text: 'codex asks to show documents', href: '/approve/a3' },
      { key: 'change shop', text: 'shop asks for a change', href: '/change/shop' },
    ]);
  });

  it('counts the documents of the folders that are shown', () => {
    const s = state(1, {
      documents: [
        { Hidden: false, Docs: [{}, {}] },
        { Hidden: true, Docs: [{}] },
        { Hidden: false, Docs: null },
      ] as State['documents'],
    });
    expect(documentCount(s)).toBe(2);
  });
});
