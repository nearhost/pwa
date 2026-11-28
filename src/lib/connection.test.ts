import { describe, expect, it } from 'vitest';
import { connectionReason } from './connection.js';

const at = new Date(2026, 10, 27, 10, 42);

describe('connectionReason', () => {
  it('says nothing when live', () => {
    expect(connectionReason('live', 'leto', at)).toBeUndefined();
  });

  it('says it is connecting', () => {
    expect(connectionReason('connecting', 'leto', undefined)).toBe(
      'Connecting to leto. Starting and stopping wait until it answers.',
    );
  });

  it('says the machine is out of reach, and when it last answered', () => {
    const reason = connectionReason('lost', 'leto', at)!;
    expect(reason).toMatch(/^Can't reach leto\. This is what it said at 10:42/);
    expect(reason).toMatch(/starting and stopping wait until it's back\.$/);
  });

  it('says the machine is out of reach without a time when it never answered', () => {
    expect(connectionReason('lost', 'leto', undefined)).toBe(
      "Can't reach leto. Starting and stopping wait until it's back.",
    );
  });

  it('says the device is not paired', () => {
    expect(connectionReason('signed-out', 'leto', at)).toBe(
      "This device isn't paired with leto, so nothing here can be changed.",
    );
  });

  it('names the action that waits, when a screen gives one', () => {
    expect(connectionReason('connecting', 'leto', undefined, 'answering')).toBe(
      'Connecting to leto. Answering waits until it answers.',
    );
    expect(connectionReason('lost', 'leto', undefined, 'answering')).toBe(
      "Can't reach leto. Answering waits until it's back.",
    );
  });

  it('says wait for two actions', () => {
    expect(connectionReason('connecting', 'leto', undefined, 'revoking and unpairing')).toBe(
      'Connecting to leto. Revoking and unpairing wait until it answers.',
    );
    expect(connectionReason('lost', 'leto', at, 'revoking and unpairing')).toMatch(
      /; revoking and unpairing wait until it's back\.$/,
    );
  });
});
