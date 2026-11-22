import { describe, expect, it } from 'vitest';
import { shouldRetry } from './retry.js';

describe('shouldRetry', () => {
  it('retries IO and 502/503/504 up to three more attempts', () => {
    expect(shouldRetry({ httpStatus: null, ioError: true, attemptsAfterFailure: 1 })).toEqual({
      retry: true,
      delayMs: 30_000,
    });
    expect(shouldRetry({ httpStatus: 503, ioError: false, attemptsAfterFailure: 2 })).toEqual({
      retry: true,
      delayMs: 120_000,
    });
    expect(shouldRetry({ httpStatus: 504, ioError: false, attemptsAfterFailure: 3 })).toEqual({
      retry: true,
      delayMs: 600_000,
    });
    expect(shouldRetry({ httpStatus: 502, ioError: false, attemptsAfterFailure: 4 })).toEqual({
      retry: false,
      delayMs: null,
    });
  });

  it('does not retry 401 or other 4xx', () => {
    for (const httpStatus of [400, 401, 404, 409, 422, 429]) {
      expect(shouldRetry({ httpStatus, ioError: false, attemptsAfterFailure: 1 }).retry).toBe(false);
    }
  });
});
