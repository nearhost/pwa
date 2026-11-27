import { describe, expect, it } from 'vitest';
import { appName } from '#lib';

describe('appName', () => {
  it('is Nearhost', () => {
    expect(appName).toBe('Nearhost');
  });
});
