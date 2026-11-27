// The documents agents have had Nearhost serve: the list the state gives, the reader's paths and the
// address the core serves each document at, /d/<tree id>/<path below the tree's root>.
import type { State } from '#lib/api/types.js';
import { localOrigin, requesterName } from '#lib/approvals/model.js';
import type { DocumentsTheme } from '#lib/settings.js';

export type Tree = NonNullable<State['documents']>[number];
export type Scheme = 'light' | 'dark';

/** The reader's themes, in the switch's order, with the words the canvas uses. */
export const themes: { id: DocumentsTheme; label: string }[] = [
  { id: 'paper', label: 'Paper' },
  { id: 'app', label: 'Match app' },
  { id: 'written', label: 'As written' },
];

function escapePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Where the core serves a document, with the theme the reader asks for. Paper is the same page in
 * either scheme, so only Match app names one: the app's, which may differ from the system's.
 */
export function documentSrc(id: string, path: string, theme: DocumentsTheme, scheme: Scheme) {
  const src = `/d/${encodeURIComponent(id)}/${escapePath(path)}`;
  if (theme === 'paper') return `${src}?theme=paper`;
  if (theme === 'app') return `${src}?theme=app&scheme=${scheme}`;
  return src;
}

/** The app's path to the reader for a document. */
export function readerHref(id: string, path: string): string {
  return `/documents/${encodeURIComponent(id)}/${escapePath(path)}`;
}

/** The tree and the path the reader's rest parameter (decoded) names, if it names both. */
export function readerTarget(rest: string): { id: string; path: string } | undefined {
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return undefined;
  return { id: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

export function titleOf(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

export function folderOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}

/** The machine a tree is on, as people call it: this machine's name, or the server's. */
export function whereOf(server: string, machine: string): string {
  return server === localOrigin || server === '' ? machine : server;
}

export interface DocView {
  path: string;
  title: string;
  folder: string;
  href: string;
  opened: string;
}

export interface TreeView {
  id: string;
  /** The root folder's own name. */
  name: string;
  where: string;
  root: string;
  requester: string;
  docs: DocView[];
}

/** The trees with documents, newest first as the core lists them, each's documents newest first. */
export function documentTrees(state: State | undefined, machine: string): TreeView[] {
  const out: TreeView[] = [];
  for (const tree of state?.documents ?? []) {
    if (!tree.Docs?.length) continue;
    out.push({
      id: tree.ID,
      name: titleOf(tree.Root) || tree.Root,
      where: whereOf(tree.Server, machine),
      root: tree.Root,
      requester: requesterName(tree.Requester),
      docs: tree.Docs.map((d) => ({
        path: d.Path,
        title: titleOf(d.Path),
        folder: folderOf(d.Path),
        href: readerHref(tree.ID, d.Path),
        opened: d.Opened,
      })),
    });
  }
  return out;
}

/** The tree serving path, while the core still serves it. */
export function findDocument(
  state: State | undefined,
  id: string,
  path: string,
): { tree: Tree } | undefined {
  const tree = state?.documents?.find((t) => t.ID === id);
  if (!tree?.Docs?.some((d) => d.Path === path)) return undefined;
  return { tree };
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/** When a document was opened: the time today, the day this year, the date before that. */
export function openedLabel(iso: string, now = new Date()): string {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime()) || at.getFullYear() < 2000) return '';
  if (at.toDateString() === now.toDateString())
    return `${two(at.getHours())}:${two(at.getMinutes())}`;
  const day = `${at.getDate()} ${months[at.getMonth()]}`;
  return at.getFullYear() === now.getFullYear() ? day : `${day} ${at.getFullYear()}`;
}

/** The app's scheme: the appearance setting's (data-theme on <html>), else the system's. */
export function schemeOf(dataTheme: string | null, prefersDark: boolean): Scheme {
  if (dataTheme === 'light' || dataTheme === 'dark') return dataTheme;
  return prefersDark ? 'dark' : 'light';
}
