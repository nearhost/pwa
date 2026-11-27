import { describe, expect, it } from 'vitest';
import { state } from '#lib/api/testing.js';
import type { State } from '#lib/api/types.js';
import {
  documentSrc,
  documentTrees,
  findDocument,
  folderOf,
  openedLabel,
  readerHref,
  readerTarget,
  schemeOf,
  titleOf,
} from './model.js';

type Tree = NonNullable<State['documents']>[number];

function tree(extra: Partial<Tree> = {}): Tree {
  return {
    ID: 'T1',
    Server: 'local',
    Root: '/Users/ecs/Code/storefront',
    Requester: 'claude-code',
    RootHandle: '',
    Docs: [{ Path: 'docs/plans/checkout.md', Opened: '2026-11-27T10:51:00Z' }],
    Opened: '2026-11-27T10:00:00Z',
    Hidden: false,
    ...extra,
  };
}

describe('a document’s address', () => {
  it('is /d/<tree id>/<path> with each segment escaped', () => {
    expect(documentSrc('T1', 'docs/plans/checkout.md', 'written', 'dark')).toBe(
      '/d/T1/docs/plans/checkout.md',
    );
    expect(documentSrc('T1', 'my plans/a#b?.md', 'written', 'dark')).toBe(
      '/d/T1/my%20plans/a%23b%3F.md',
    );
  });

  it('asks for paper without a scheme: paper is the same in both', () => {
    expect(documentSrc('T1', 'a.md', 'paper', 'dark')).toBe('/d/T1/a.md?theme=paper');
    expect(documentSrc('T1', 'a.md', 'paper', 'light')).toBe('/d/T1/a.md?theme=paper');
  });

  it('asks for the app’s theme in the app’s scheme', () => {
    expect(documentSrc('T1', 'a.md', 'app', 'dark')).toBe('/d/T1/a.md?theme=app&scheme=dark');
    expect(documentSrc('T1', 'a.md', 'app', 'light')).toBe('/d/T1/a.md?theme=app&scheme=light');
  });
});

describe('the reader’s path', () => {
  it('is /documents/<tree id>/<path>, escaped, and reads back decoded', () => {
    const href = readerHref('T1', 'my plans/a#b.md');
    expect(href).toBe('/documents/T1/my%20plans/a%23b.md');
    // SvelteKit hands the rest parameter over decoded.
    expect(readerTarget(decodeURIComponent(href.slice('/documents/'.length)))).toEqual({
      id: 'T1',
      path: 'my plans/a#b.md',
    });
  });

  it('needs a tree and a path', () => {
    expect(readerTarget('')).toBeUndefined();
    expect(readerTarget('T1')).toBeUndefined();
    expect(readerTarget('T1/')).toBeUndefined();
    expect(readerTarget('T1/index.html')).toEqual({ id: 'T1', path: 'index.html' });
  });
});

describe('names', () => {
  it('titles a document by its file name and places it by its folder', () => {
    expect(titleOf('docs/plans/checkout.md')).toBe('checkout.md');
    expect(titleOf('README.md')).toBe('README.md');
    expect(folderOf('docs/plans/checkout.md')).toBe('docs/plans');
    expect(folderOf('README.md')).toBe('');
  });
});

describe('the list', () => {
  it('lists every tree with documents, newest first as the core gives them', () => {
    const s = state(1, {
      documents: [
        tree({ ID: 'T2', Server: 'build-box', Root: '/home/ecs/src/api', Requester: 'codex' }),
        tree({ ID: 'T1' }),
        tree({ ID: 'T3', Docs: null }),
        tree({ ID: 'T4', Docs: [] }),
        tree({ ID: 'T5', Root: '/Users/ecs/.claude/plans', Hidden: true }),
      ],
    });
    const trees = documentTrees(s, 'leto');
    expect(trees.map((t) => t.id)).toEqual(['T2', 'T1', 'T5']);
    expect(trees[0]).toMatchObject({
      name: 'api',
      where: 'build-box',
      root: '/home/ecs/src/api',
      requester: 'Codex',
    });
    expect(trees[1]).toMatchObject({ name: 'storefront', where: 'leto', requester: 'Claude Code' });
    expect(trees[1].docs).toEqual([
      {
        path: 'docs/plans/checkout.md',
        title: 'checkout.md',
        folder: 'docs/plans',
        href: '/documents/T1/docs/plans/checkout.md',
        opened: '2026-11-27T10:51:00Z',
      },
    ]);
  });

  it('is empty without a state', () => {
    expect(documentTrees(undefined, 'leto')).toEqual([]);
  });

  it('finds a document by its tree and path, or says it isn’t served', () => {
    const s = state(1, { documents: [tree()] });
    expect(findDocument(s, 'T1', 'docs/plans/checkout.md')?.tree.ID).toBe('T1');
    expect(findDocument(s, 'T1', 'docs/other.md')).toBeUndefined();
    expect(findDocument(s, 'T9', 'docs/plans/checkout.md')).toBeUndefined();
  });
});

describe('when a document was opened', () => {
  const now = new Date(2026, 10, 27, 15, 0);

  it('says the time today, the day this year and the year before', () => {
    expect(openedLabel(new Date(2026, 10, 27, 9, 5).toISOString(), now)).toBe('09:05');
    expect(openedLabel(new Date(2026, 10, 3, 9, 5).toISOString(), now)).toBe('3 Nov');
    expect(openedLabel(new Date(2025, 0, 30, 9, 5).toISOString(), now)).toBe('30 Jan 2025');
  });

  it('says nothing for a time it can’t read', () => {
    expect(openedLabel('', now)).toBe('');
    expect(openedLabel('0001-01-01T00:00:00Z', now)).toBe('');
  });
});

describe('the app’s scheme', () => {
  it('is the appearance setting, or the system’s', () => {
    expect(schemeOf('light', true)).toBe('light');
    expect(schemeOf('dark', false)).toBe('dark');
    expect(schemeOf(null, true)).toBe('dark');
    expect(schemeOf(null, false)).toBe('light');
  });
});
