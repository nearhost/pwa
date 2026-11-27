import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { appName, appVersion } from '#lib';

describe('appName', () => {
  it('is Nearhost', () => {
    expect(appName).toBe('Nearhost');
  });
});

describe('appVersion', () => {
  it('is package.json’s', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(appVersion).toBe(pkg.version);
  });
});
