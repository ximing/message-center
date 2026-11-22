import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { oidcEnabled, type OidcEnv } from './oidc.js';

const full: OidcEnv = {
  OIDC_ISSUER: 'https://id.example',
  OIDC_CLIENT_ID: 'client',
  OIDC_CLIENT_SECRET: 'secret',
  OIDC_REDIRECT_URI: 'https://app.example/cb',
  OIDC_AUDIENCE: 'message-center',
};

describe('oidcEnabled', () => {
  it('is true only when all five fields are non-blank', () => {
    expect(oidcEnabled(full)).toBe(true);
    expect(oidcEnabled({})).toBe(false);
    expect(oidcEnabled({ ...full, OIDC_AUDIENCE: '   ' })).toBe(false);
    expect(oidcEnabled({ ...full, OIDC_CLIENT_SECRET: undefined })).toBe(false);
  });
});

describe('GET /api/auth/oidc/status', () => {
  it('is disabled when the test env has no OIDC vars', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/api/auth/oidc/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ enabled: false });
    } finally {
      await app.close();
    }
  });
});
