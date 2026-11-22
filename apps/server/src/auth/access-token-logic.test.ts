import { describe, expect, it } from 'vitest';
import { isAccountKey } from '../keys/api-key-logic.js';
import { generateAccessToken, isPersonalAccessToken } from './access-token-logic.js';

describe('access token shape', () => {
  it('prefixes mct_ and does not look like an ingest key', () => {
    const token = generateAccessToken(Buffer.alloc(32, 7));
    expect(token.startsWith('mct_')).toBe(true);
    expect(isPersonalAccessToken(token)).toBe(true);
    expect(isAccountKey(token)).toBe(false);
  });

  it('rejects short or wrong-prefix strings', () => {
    expect(isPersonalAccessToken('mct_short')).toBe(false);
    expect(isPersonalAccessToken(`mck_${'a'.repeat(48)}`)).toBe(false);
    expect(isPersonalAccessToken('eyJhbGciOiJIUzI1NiJ9.payload.sig')).toBe(false);
  });
});