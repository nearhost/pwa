// The overview's view of the state: projects grouped by the machine they run on, the addresses
// they open at, and how much waits for the user (#lib/approvals says what).
import type { State } from '#lib/api/types.js';
import type { OpenProjectsIn } from '#lib/settings.js';

export type ProjectStatus = NonNullable<State['projects']>[string];
export type Site = NonNullable<State['sites']>[string];
export type SiteRoute = NonNullable<Site['routes']>[number];
export type EngineState = ProjectStatus['State'];

export interface ProjectView {
  name: string;
  status: ProjectStatus;
  routes: SiteRoute[];
  /** The primary route; undefined for a project with no web route. */
  primary?: SiteRoute;
}

export interface MachineGroup {
  /** '' for this machine, else the server's name. */
  key: string;
  name: string;
  local: boolean;
  projects: ProjectView[];
  running: number;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** The projects by machine: this machine first (named machine), then each server by name. */
export function groupByMachine(state: State, machine: string): MachineGroup[] {
  const groups = new Map<string, MachineGroup>();
  for (const [name, status] of Object.entries(state.projects ?? {})) {
    const site = state.sites?.[name];
    const key = site?.server ?? '';
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: key || machine || 'This machine',
        local: key === '',
        projects: [],
        running: 0,
      };
      groups.set(key, group);
    }
    const routes = site?.routes ?? [];
    group.projects.push({ name, status, routes, primary: routes[0] });
    if (status.State === 'running') group.running++;
  }
  for (const group of groups.values()) group.projects.sort(byName);
  return [...groups.values()].sort((a, b) =>
    a.local === b.local ? byName(a, b) : a.local ? -1 : 1,
  );
}

/** The groups with only the projects whose name has query in it; all of them for no query. */
export function filterGroups(groups: MachineGroup[], query: string): MachineGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => {
      const projects = g.projects.filter((p) => p.name.toLowerCase().includes(q));
      return {
        ...g,
        projects,
        running: projects.filter((p) => p.status.State === 'running').length,
      };
    })
    .filter((g) => g.projects.length > 0);
}

/** Whether address is an http or https address, the only kind the app opens or frames. */
export function isWebAddress(address: string | undefined): address is string {
  if (!address) return false;
  try {
    const { protocol } = new URL(address);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Where a route opens: its network address on a networked core, else its local one; undefined
 * for one that is not an http or https address.
 */
export function addressOf(route: SiteRoute | undefined, networked: boolean): string | undefined {
  if (!route) return undefined;
  const address = (networked && route.networkUrl) || route.url;
  return isWebAddress(address) ? address : undefined;
}

/** Where Preview goes: the app's preview, or the browser when the device or project says so. */
export function previewLink(
  name: string,
  address: string | undefined,
  settings: { openIn: OpenProjectsIn; always: boolean },
): { href: string; browser: boolean } {
  if (address && (settings.openIn === 'browser' || settings.always)) {
    return { href: address, browser: true };
  }
  return { href: `/projects/${encodeURIComponent(name)}`, browser: false };
}

const labels: Record<EngineState, string> = {
  running: 'Running',
  starting: 'Starting',
  stopped: 'Stopped',
  error: 'Error',
  degraded: 'Degraded',
};

export function stateLabel(state: EngineState): string {
  return labels[state] ?? state;
}

/** The name an address shows: its host. */
export function hostOf(address: string | undefined): string {
  if (!address) return '';
  try {
    return new URL(address).host;
  } catch {
    return address;
  }
}

/** How many things wait for the user: agents' requests and projects' changes. */
export function waitingCount(state: State | undefined): number {
  if (!state) return 0;
  const changes = Object.values(state.projects ?? {}).filter((p) => p.Pending).length;
  return (state.approvals?.length ?? 0) + changes;
}

/** The documents in the folders that are shown. */
export function documentCount(state: State | undefined): number {
  let n = 0;
  for (const tree of state?.documents ?? []) if (!tree.Hidden) n += tree.Docs?.length ?? 0;
  return n;
}
