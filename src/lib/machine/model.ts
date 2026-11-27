// What the This machine screen says: how the core serves, from GET /v1/status, and the paired
// devices from GET /v1/devices, as the canvas's lines.
import type { DeviceInfo, Info, Status } from '#lib/api/types.js';

export type Tone = 'running' | 'starting' | 'failed' | 'quiet';

export interface Fact {
  term: string;
  value: string;
  /** An address, set in the mono face. */
  mono?: boolean;
  /** The status's dot. */
  tone?: Tone;
}

/** The host of an address such as https://nearhost.lab.example.dev/, or "" for none. */
function hostOf(address: string): string {
  if (!address) return '';
  try {
    return new URL(address).host;
  } catch {
    return address;
  }
}

const certificateNames: Record<string, string> = {
  acme: "Let's Encrypt",
  ca: "Nearhost's own certificate authority",
};

/**
 * The facts about the machine, in the canvas's order: its status, page address, the projects'
 * domain and certificates when it serves the network, and the version of the core (once known)
 * and of this app. Before the status is read, the version alone.
 */
export function machineFacts(
  status: Status | undefined,
  info: Info | undefined,
  appVersion: string,
): Fact[] {
  const facts: Fact[] = [];
  if (status) {
    const network = status.network?.on ? status.network : undefined;
    if (!network) {
      facts.push({ term: 'Status', value: 'Serving on this machine only', tone: 'quiet' });
    } else if (network.problem) {
      facts.push({ term: 'Status', value: network.problem, tone: 'failed' });
    } else if (!network.listening) {
      facts.push({ term: 'Status', value: 'Not listening on the network yet', tone: 'starting' });
    } else {
      facts.push({ term: 'Status', value: 'Serving on the network', tone: 'running' });
    }
    const page = hostOf(network?.url || status.page);
    facts.push({ term: 'Page address', value: page || 'Not served', mono: !!page });
    if (network) {
      const domain = page.toLowerCase().startsWith('nearhost.')
        ? page.slice('nearhost.'.length)
        : '';
      if (domain) facts.push({ term: 'Projects', value: `*.${domain}`, mono: true });
      facts.push({
        term: 'Certificates',
        value: certificateNames[network.certificates] ?? network.certificates,
      });
    }
  }
  const core = (status?.info ?? info)?.version;
  facts.push({
    term: 'Version',
    value: core ? `Nearhost ${core} · app ${appVersion}` : `App ${appVersion}`,
  });
  return facts;
}

export interface DeviceView {
  name: string;
  /** The device this app runs on. */
  self: boolean;
  /** The icon: a phone for a name that says so, else a tablet. */
  kind: 'phone' | 'tablet';
  /** "Paired 26 November · seen now". */
  detail: string;
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// A time the core has not set (Go's zero time) or cannot read.
function timeOf(iso: string): Date | undefined {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime()) || at.getFullYear() < 2000) return undefined;
  return at;
}

function dayLabel(at: Date, now: Date): string {
  const day = `${at.getDate()} ${months[at.getMonth()]}`;
  return at.getFullYear() === now.getFullYear() ? day : `${day} ${at.getFullYear()}`;
}

/** When a device was last seen, such as "seen 3 days ago", or "" when never. */
export function seenLabel(iso: string, now = new Date()): string {
  const at = timeOf(iso);
  if (!at) return '';
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 2) return 'seen now';
  if (minutes < 60) return `seen ${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 2) return 'seen an hour ago';
  if (hours < 24) return `seen ${hours} hours ago`;
  if (hours < 48) return 'seen yesterday';
  return `seen ${Math.floor(hours / 24)} days ago`;
}

/** The paired devices, this one first, then the most recently seen. */
export function deviceViews(devices: DeviceInfo[], self: string, now = new Date()): DeviceView[] {
  const seen = (d: DeviceInfo) => timeOf(d.last_seen)?.getTime() ?? 0;
  return [...devices]
    .sort((a, b) => Number(b.name === self) - Number(a.name === self) || seen(b) - seen(a))
    .map((d) => {
      const paired = timeOf(d.paired);
      const parts = [paired ? `Paired ${dayLabel(paired, now)}` : '', seenLabel(d.last_seen, now)];
      return {
        name: d.name,
        self: !!self && d.name === self,
        kind: /phone|pixel|android/i.test(d.name) ? 'phone' : 'tablet',
        detail: parts.filter(Boolean).join(' · '),
      };
    });
}
