import { describe, expect, it } from 'vitest';
import { decideLive, parseLiveSince } from './live-logic.js';

describe('live feed', () => {
  it('treats a missing cursor as a handshake', () => {
    expect(decideLive(4n, null)).toEqual({ revision: '4', changed: false });
  });

  it('stays quiet when the cursor matches', () => {
    expect(decideLive(4n, 4n)).toEqual({ revision: '4', changed: false });
  });

  it('reports a change when the cursor is behind or ahead', () => {
    expect(decideLive(4n, 3n)).toEqual({ revision: '4', changed: true });
    expect(decideLive(0n, 5n)).toEqual({ revision: '0', changed: true });
  });

  it('rejects a cursor that is not a revision', () => {
    expect(parseLiveSince(undefined)).toBeNull();
    expect(parseLiveSince('0')).toBe(0n);
    expect(parseLiveSince('12')).toBe(12n);
    expect(() => parseLiveSince('')).toThrow('VALIDATION_ERROR');
    expect(() => parseLiveSince('01')).toThrow('VALIDATION_ERROR');
    expect(() => parseLiveSince('-1')).toThrow('VALIDATION_ERROR');
    expect(() => parseLiveSince(4)).toThrow('VALIDATION_ERROR');
  });
});
