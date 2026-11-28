import { describe, expect, it } from 'vitest';
import { frameWidths, isCrossSite, routeLabel } from './model.js';

describe('isCrossSite', () => {
  it('is false for a name under the networked page’s domain', () => {
    expect(isCrossSite('https://shop.lab.example.dev/x', 'nearhost.lab.example.dev')).toBe(false);
    expect(isCrossSite('https://lab.example.dev', 'nearhost.lab.example.dev')).toBe(false);
  });

  it('is true for an alias outside it', () => {
    expect(isCrossSite('https://shop.example.com/', 'nearhost.lab.example.dev')).toBe(true);
    expect(isCrossSite('https://notlab.example.dev/', 'nearhost.lab.example.dev')).toBe(true);
  });

  it('is false when the page is not on a networked name, where no domain is known', () => {
    expect(isCrossSite('https://shop.test/', 'localhost')).toBe(false);
  });

  it('is true for an address that is not an http or https one, wherever the page is', () => {
    expect(isCrossSite('not a url', 'nearhost.lab.example.dev')).toBe(true);
    expect(isCrossSite('javascript:alert(1)', 'localhost')).toBe(true);
    expect(isCrossSite('data:text/html,x', 'nearhost.lab.example.dev')).toBe(true);
  });
});

describe('routeLabel', () => {
  it("drops the primary route's domain from each route's name", () => {
    const primary = 'storefront.lab.example.dev';
    expect(routeLabel('storefront.lab.example.dev', primary)).toBe('storefront');
    expect(routeLabel('mail.storefront.lab.example.dev', primary)).toBe('mail.storefront');
    expect(routeLabel('shop.test', 'shop.test')).toBe('shop');
  });

  it('keeps a name outside that domain whole', () => {
    expect(routeLabel('other.example.com', 'storefront.lab.example.dev')).toBe('other.example.com');
  });
});

describe('frameWidths', () => {
  it('fills, or takes the iPad and phone widths of the canvas', () => {
    expect(frameWidths.map((w) => [w.id, w.width])).toEqual([
      ['fill', undefined],
      ['tablet', 834],
      ['phone', 390],
    ]);
  });
});
