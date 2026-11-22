import type { LiveFeed } from '@mc/dto';

const MAX_REVISION = 9223372036854775807n;

/** `null` is the handshake: the client has no cursor yet. */
export function decideLive(current: bigint, since: bigint | null): LiveFeed {
  const revision = current.toString();
  if (since === null || since === current) return { revision, changed: false };
  return { revision, changed: true };
}

export function parseLiveSince(raw: unknown): bigint | null {
  if (raw === undefined) return null;
  if (typeof raw !== 'string' || !/^(?:0|[1-9]\d{0,18})$/.test(raw)) {
    throw new Error('VALIDATION_ERROR');
  }
  const value = BigInt(raw);
  if (value > MAX_REVISION) throw new Error('VALIDATION_ERROR');
  return value;
}
