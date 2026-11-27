import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  answeredAt,
  lostLong,
  readLastSeen,
  showOffline,
  writeLastSeen,
  type OfflineInput,
} from './model.js';

const now = new Date(2026, 10, 27, 10, 50).getTime();
const base: OfflineInput = { connection: 'lost', lostSince: now, answered: true, now };

describe('showOffline', () => {
  it('never shows while live, signed out or still connecting the first time', () => {
    expect(showOffline({ ...base, connection: 'live', lostSince: undefined })).toBe(false);
    expect(showOffline({ ...base, connection: 'signed-out', lostSince: undefined })).toBe(false);
    expect(
      showOffline({ connection: 'connecting', lostSince: undefined, answered: false, now }),
    ).toBe(false);
  });

  it('shows at once when the core has not answered since the app loaded', () => {
    expect(showOffline({ ...base, answered: false })).toBe(true);
  });

  it('waits 10 s of lost before replacing a screen the core had answered', () => {
    expect(showOffline({ ...base, now: now + lostLong - 1 })).toBe(false);
    expect(showOffline({ ...base, now: now + lostLong })).toBe(true);
  });

  it('stays while Try again is connecting', () => {
    expect(
      showOffline({ ...base, connection: 'connecting', answered: false, now: now + 1000 }),
    ).toBe(true);
    expect(showOffline({ ...base, connection: 'connecting', now: now + lostLong })).toBe(true);
  });
});

describe('answeredAt', () => {
  it('gives the time alone for today', () => {
    expect(answeredAt(new Date(2026, 10, 27, 10, 42), new Date(now))).toMatch(/^10:42\b/);
  });

  it('gives the day too for an earlier day', () => {
    const said = answeredAt(new Date(2026, 10, 25, 9, 5), new Date(now));
    expect(said).toMatch(/25/);
    expect(said).toMatch(/09:05/);
  });
});

describe('the last answer, kept on the device', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('keeps the machine and the time under nearhost.lastAnswered', () => {
    vi.stubGlobal('localStorage', storage);
    const at = new Date(2026, 10, 27, 10, 42);
    writeLastSeen({ machine: 'leto', at });
    expect(JSON.parse(store.get('nearhost.lastAnswered')!)).toEqual({
      machine: 'leto',
      at: at.toISOString(),
    });
    expect(readLastSeen()).toEqual({ machine: 'leto', at });
  });

  it('reads nothing from a missing or broken entry', () => {
    vi.stubGlobal('localStorage', storage);
    expect(readLastSeen()).toBeUndefined();
    store.set('nearhost.lastAnswered', '{not json');
    expect(readLastSeen()).toBeUndefined();
    store.set('nearhost.lastAnswered', JSON.stringify({ machine: 3, at: 'never' }));
    expect(readLastSeen()).toBeUndefined();
  });

  it('carries on when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => writeLastSeen({ machine: 'leto', at: new Date(now) })).not.toThrow();
    expect(readLastSeen()).toBeUndefined();
  });
});
