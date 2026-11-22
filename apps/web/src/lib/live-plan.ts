const POLL_DELAYS_MS = [2_000, 4_000, 8_000, 30_000] as const;

/** Healthy poll is 2000. Each consecutive failure steps 4000, 8000, then 30000. */
export function nextPollDelayMs(failures: number): number {
  const index = failures <= 0 ? 0 : Math.min(Math.floor(failures), POLL_DELAYS_MS.length - 1);
  return POLL_DELAYS_MS[index] ?? 30_000;
}

/**
 * Handshake (`current === null`) adopts the revision without a reload.
 * A change moves the cursor only after the open page applied it.
 */
export function nextCursor(
  current: string | null,
  revision: string,
  changed: boolean,
  applied: boolean,
): string {
  if (current === null || !changed || applied) return revision;
  return current;
}
