import { describe, expect, it } from 'vitest';
import type { DeviceInfo, Info, NetworkInfo, Status } from '#lib/api/types.js';
import { deviceViews, machineFacts, seenLabel } from './model.js';

const info = { api: 1, version: '0.17.0', pid: 1, started: '', startedBy: 'service' } as Info;

function status(network?: Partial<NetworkInfo>, page = 'https://nearhost.localhost'): Status {
  return {
    info,
    servers: null,
    projects: null,
    approvals: null,
    page,
    network: network
      ? {
          on: true,
          listening: true,
          url: 'https://nearhost.lab.example.dev',
          certificates: 'acme',
          ...network,
        }
      : undefined,
  };
}

const facts = (s: Status | undefined, i: Info | undefined = info) =>
  Object.fromEntries(machineFacts(s, i, '0.4.0').map((f) => [f.term, f]));

describe('machineFacts', () => {
  it('says how a networked core serves, as the canvas has it', () => {
    const f = facts(status({}));
    expect(f.Status).toMatchObject({ value: 'Serving on the network', tone: 'running' });
    expect(f['Page address']).toMatchObject({ value: 'nearhost.lab.example.dev', mono: true });
    expect(f.Projects).toMatchObject({ value: '*.lab.example.dev', mono: true });
    expect(f.Certificates.value).toBe("Let's Encrypt");
    expect(f.Version.value).toBe('Nearhost 0.17.0 · app 0.4.0');
    expect(Object.keys(f)).toEqual([
      'Status',
      'Page address',
      'Projects',
      'Certificates',
      'Version',
    ]);
  });

  it('names the local certificate authority', () => {
    expect(facts(status({ certificates: 'ca' })).Certificates.value).toBe(
      "Nearhost's own certificate authority",
    );
  });

  it('gives the problem when the core serves less than the config asks', () => {
    const f = facts(status({ listening: false, problem: 'The firewall blocks port 443' }));
    expect(f.Status).toMatchObject({ value: 'The firewall blocks port 443', tone: 'failed' });
  });

  it('says starting when networked mode is on but not listening yet, without a problem', () => {
    expect(facts(status({ listening: false })).Status).toMatchObject({
      value: 'Not listening on the network yet',
      tone: 'starting',
    });
  });

  it('on a core that does not serve the network: this machine only, the local page', () => {
    const f = facts(status(undefined));
    expect(f.Status).toMatchObject({ value: 'Serving on this machine only', tone: 'quiet' });
    expect(f['Page address'].value).toBe('nearhost.localhost');
    expect(f.Projects).toBeUndefined();
    expect(f.Certificates).toBeUndefined();
    expect(facts(status({ on: false })).Projects).toBeUndefined();
  });

  it('says when the page is not served', () => {
    expect(facts(status(undefined, ''))['Page address'].value).toBe('Not served');
  });

  it('gives the version alone before the status is read, and the app version always', () => {
    expect(Object.keys(facts(undefined))).toEqual(['Version']);
    expect(machineFacts(undefined, undefined, '0.4.0')).toEqual([
      { term: 'Version', value: 'App 0.4.0' },
    ]);
  });
});

const now = new Date(2026, 10, 27, 12, 0);

describe('seenLabel', () => {
  it('reads now, minutes, hours, yesterday and days', () => {
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    const min = 60_000;
    expect(seenLabel(ago(30_000), now)).toBe('seen now');
    expect(seenLabel(ago(5 * min), now)).toBe('seen 5 minutes ago');
    expect(seenLabel(ago(60 * min), now)).toBe('seen an hour ago');
    expect(seenLabel(ago(3 * 60 * min), now)).toBe('seen 3 hours ago');
    expect(seenLabel(ago(30 * 60 * min), now)).toBe('seen yesterday');
    expect(seenLabel(ago(3 * 24 * 60 * min), now)).toBe('seen 3 days ago');
  });

  it('says nothing for a time that is not set', () => {
    expect(seenLabel('0001-01-01T00:00:00Z', now)).toBe('');
    expect(seenLabel('', now)).toBe('');
  });
});

describe('deviceViews', () => {
  const device = (name: string, paired: string, seen: string): DeviceInfo => ({
    name,
    paired,
    last_seen: seen,
    last_addr: '192.168.77.20:50000',
  });

  it('puts this device first, then the most recently seen, with the canvas’s line', () => {
    const views = deviceViews(
      [
        device(
          'Phone',
          new Date(2026, 10, 20).toISOString(),
          new Date(2026, 10, 24, 12).toISOString(),
        ),
        device(
          'Laptop',
          new Date(2025, 0, 2).toISOString(),
          new Date(2026, 10, 27, 11).toISOString(),
        ),
        device('iPad Pro', new Date(2026, 10, 26).toISOString(), now.toISOString()),
      ],
      'iPad Pro',
      now,
    );
    expect(views.map((v) => [v.name, v.self, v.kind, v.detail])).toEqual([
      ['iPad Pro', true, 'tablet', 'Paired 26 November · seen now'],
      ['Laptop', false, 'tablet', 'Paired 2 January 2025 · seen an hour ago'],
      ['Phone', false, 'phone', 'Paired 20 November · seen 3 days ago'],
    ]);
  });

  it('marks no device as this one for the page cookie', () => {
    const views = deviceViews([device('Phone', now.toISOString(), now.toISOString())], '', now);
    expect(views[0].self).toBe(false);
  });

  it('draws a phone for a name that says so', () => {
    const kinds = ['iPhone', 'Pixel 9', 'Android tablet?', 'My phone', 'iPad'].map(
      (name) => deviceViews([device(name, '', '')], '', now)[0].kind,
    );
    expect(kinds).toEqual(['phone', 'phone', 'phone', 'phone', 'tablet']);
  });
});
