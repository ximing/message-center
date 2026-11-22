import { describe, expect, it } from 'vitest';
import { decideEmail, resolveOidcConfig, sanitizeReturnTo, type OidcEnv } from './oidc-logic.js';

const env: OidcEnv = {
  NODE_ENV: 'production',
  WEB_ORIGIN: 'https://msg.aimo.plus',
  OIDC_ISSUER: 'https://super-agent-auth.aimo.plus/realms/aimo-plus-prod',
  OIDC_CLIENT_ID: 'message-center',
  OIDC_CLIENT_SECRET: '1234567890abcdef',
  OIDC_REDIRECT_URI: 'https://msg.aimo.plus/api/auth/oidc/callback',
  OIDC_AUDIENCE: 'message-center-api',
};

describe('resolveOidcConfig', () => {
  it('stays off when nothing is set, and off when the set is incomplete or borrowed', () => {
    expect(resolveOidcConfig({ NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:5191' }).enabled).toBe(false);
    expect(resolveOidcConfig({ ...env, OIDC_CLIENT_SECRET: undefined }).enabled).toBe(false);
    expect(resolveOidcConfig({ ...env, OIDC_CLIENT_ID: 'inwit' }).enabled).toBe(false);
    expect(resolveOidcConfig({ ...env, OIDC_AUDIENCE: 'inwit-api' }).enabled).toBe(false);
    expect(
      resolveOidcConfig({ ...env, OIDC_REDIRECT_URI: 'https://other.example/api/auth/oidc/callback' }).enabled,
    ).toBe(false);
  });

  it('accepts the message-center production callback', () => {
    const resolved = resolveOidcConfig(env);
    expect(resolved.enabled).toBe(true);
    if (!resolved.enabled) return;
    expect(resolved.config.clientId).toBe('message-center');
    expect(resolved.config.redirectUri).toBe('https://msg.aimo.plus/api/auth/oidc/callback');
    expect(resolved.config.scopes).toBe('openid profile email');
  });
});

describe('decideEmail', () => {
  it('refuses to take an email that already belongs to a password account', () => {
    expect(decideEmail('Ada@Example.com', true)).toEqual({ kind: 'conflict' });
    expect(decideEmail('ada@example.com', false)).toEqual({ kind: 'use', email: 'ada@example.com' });
    expect(decideEmail('', false).kind).toBe('synthetic');
    expect(decideEmail('not-an-email', false).kind).toBe('invalid');
  });
});

describe('sanitizeReturnTo', () => {
  it('keeps a same-origin path and drops open redirects', () => {
    expect(sanitizeReturnTo('/messages?room=1', 'https://msg.aimo.plus')).toBe('/messages?room=1');
    expect(sanitizeReturnTo('https://evil.example', 'https://msg.aimo.plus')).toBe('/');
    expect(sanitizeReturnTo('//evil.example', 'https://msg.aimo.plus')).toBe('/');
  });
});
