export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000] as const;

export interface RetryInput {
  httpStatus: number | null;
  ioError: boolean;
  /** How many tries have already failed, including the one just finished. */
  attemptsAfterFailure: number;
}

export interface RetryDecision {
  retry: boolean;
  delayMs: number | null;
}

/** IO and 502/503/504 may be tried 3 more times after the first failure. Other 4xx never retry. */
export function shouldRetry(input: RetryInput): RetryDecision {
  const retryable =
    input.ioError || input.httpStatus === 502 || input.httpStatus === 503 || input.httpStatus === 504;
  if (!retryable || input.attemptsAfterFailure > 3) return { retry: false, delayMs: null };
  const delayMs = RETRY_DELAYS_MS[input.attemptsAfterFailure - 1] ?? RETRY_DELAYS_MS[2];
  return { retry: true, delayMs };
}
