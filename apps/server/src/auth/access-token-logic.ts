import { randomBytes } from 'node:crypto';
import { ACCESS_TOKEN_PREFIX } from '@mc/dto';
import { hashApiKey, previewSecret } from '../keys/api-key-logic.js';

export const ACCESS_TOKEN_BYTES = 32;

export function generateAccessToken(entropy: Buffer = randomBytes(ACCESS_TOKEN_BYTES)): string {
  if (entropy.length !== ACCESS_TOKEN_BYTES) {
    throw new Error('access token entropy must be 32 bytes');
  }
  return `${ACCESS_TOKEN_PREFIX}${entropy.toString('base64url')}`;
}

export function hashAccessToken(token: string): string {
  return hashApiKey(token);
}

export function previewAccessToken(token: string): string {
  return previewSecret(token);
}

/** Distinguish interface tokens from session JWTs and from mck_ ingest keys. */
export function isPersonalAccessToken(token: string): boolean {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) return false;
  const body = token.slice(ACCESS_TOKEN_PREFIX.length);
  return body.length >= 40 && /^[A-Za-z0-9_-]+$/.test(body);
}
