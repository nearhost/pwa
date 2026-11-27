import { describe, expect, it } from 'vitest';
import { onThisMachine } from './page-host.js';

describe('onThisMachine', () => {
  it('is the core page host, which only this machine reaches', () => {
    expect(onThisMachine('nearhost.localhost')).toBe(true);
    expect(onThisMachine('NEARHOST.localhost')).toBe(true);
    expect(onThisMachine('nearhost.localhost.')).toBe(true);
  });

  it('is not the network page, nor any other host', () => {
    expect(onThisMachine('nearhost.lab.example.dev')).toBe(false);
    expect(onThisMachine('localhost')).toBe(false);
    expect(onThisMachine('shop.nearhost.localhost')).toBe(false);
  });
});
