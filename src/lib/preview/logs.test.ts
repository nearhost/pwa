import { describe, expect, it } from 'vitest';
import { envelope } from '#lib/api/testing.js';
import { createLogs } from './logs.svelte.js';

const line = (seq: number, Project: string, Message: string, State: '' | 'running' = '') =>
  envelope(seq, { event: { Time: '', Project, Server: '', State, Message } });

describe('project logs', () => {
  it("keeps each project's log lines, not its state changes or others' lines", () => {
    const logs = createLogs(10);
    logs.take(line(1, 'shop', 'Container started'));
    logs.take(line(2, 'shop', 'state: running', 'running'));
    logs.take(line(3, 'blog', 'hello'));
    logs.take(line(4, '', 'opened port 22'));
    logs.take(envelope(5, { kind: 'config' }));
    logs.take(line(6, 'shop', 'Listening on :80'));
    expect(logs.lines('shop')).toEqual(['Container started', 'Listening on :80']);
    expect(logs.lines('blog')).toEqual(['hello']);
    expect(logs.lines('nope')).toEqual([]);
  });

  it('keeps only the most recent lines', () => {
    const logs = createLogs(3);
    for (let i = 1; i <= 5; i++) logs.take(line(i, 'shop', `line ${i}`));
    expect(logs.lines('shop')).toEqual(['line 3', 'line 4', 'line 5']);
  });
});
