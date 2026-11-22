import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'mck_';
export const API_KEY_BYTES = 32;

export function generateApiKey(entropy: Buffer = randomBytes(API_KEY_BYTES)): string {
  if (entropy.length !== API_KEY_BYTES) {
    throw new Error('api key entropy must be 32 bytes');
  }
  return `${API_KEY_PREFIX}${entropy.toString('base64url')}`;
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isAccountKey(token: string): boolean {
  if (!token.startsWith(API_KEY_PREFIX)) return false;
  const body = token.slice(API_KEY_PREFIX.length);
  return body.length >= 40 && /^[A-Za-z0-9_-]+$/.test(body);
}

/** First 8 and last 4 characters, middle replaced with ***. */
export function previewSecret(token: string): string {
  if (token.length <= 14) return `${token.slice(0, Math.min(4, token.length))}***`;
  return `${token.slice(0, 8)}***${token.slice(-4)}`;
}
