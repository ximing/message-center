import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oidcIdentities, users } from '../db/schema.js';
import { OIDC_COOKIE, resetOidcCaches } from './oidc.service.js';
import { registerAuthRoutes } from './auth.routes.js';

const ISSUER = 'https://super-agent-auth.aimo.plus/realms/aimo-plus-prod';
const ORIGIN = 'http://localhost:5191';
const secrets = vi.hoisted(() => ({
  jwt: 'jwt-secret-jwt-secret-jwt-secret-32',
  cookie: 'cookie-secret-cookie-secret-cookie-32',
}));

const cfg = vi.hoisted(() => ({
  NODE_ENV: 'test' as const,
  WEB_ORIGIN: 'http://localhost:5191',
  JWT_SECRET: secrets.jwt,
  COOKIE_SECRET: secrets.cookie,
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 30,
  OIDC_ISSUER: undefined as string | undefined,
  OIDC_CLIENT_ID: undefined as string | undefined,
  OIDC_CLIENT_SECRET: undefined as string | undefined,
  OIDC_REDIRECT_URI: undefined as string | undefined,
  OIDC_AUDIENCE: undefined as string | undefined,
  OIDC_SCOPES: undefined as string | undefined,
}));

const box = vi.hoisted(() => ({
  nonce: '',
  email: 'new@example.com',
  throwDb: false,
  fetches: [] as Array<{ url: string; redirect?: string }>,
}));

vi.mock('../config.js', () => ({ config: cfg }));

vi.mock('jose', () => ({
  decodeProtectedHeader: () => ({ alg: 'RS256' }),
  createRemoteJWKSet: () => () => ({}),
  jwtVerify: async (token: string) => {
    if (token === 'access') {
      return { payload: { iss: ISSUER, aud: 'message-center-api', sub: 'sub-1' } };
    }
    return {
      payload: {
        iss: ISSUER,
        aud: 'message-center',
        sub: 'sub-1',
        nonce: box.nonce,
        email: box.email,
        name: 'Ada',
      },
    };
  },
  errors: {
    JWTExpired: class JWTExpired extends Error {},
    JWTClaimValidationFailed: class JWTClaimValidationFailed extends Error {
      claim = '';
    },
  },
}));

type Row = Record<string, unknown>;
const mem = vi.hoisted(() => ({
  users: [] as Row[],
  identities: [] as Row[],
}));

function listFor(table: object): Row[] {
  if (table === users) return mem.users;
  if (table === oidcIdentities) return mem.identities;
  throw new Error('unexpected table');
}

function memoryDb() {
  const db: {
    select: () => unknown;
    insert: (table: object) => unknown;
    transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
  } = {
    select() {
      return {
        from(table: object) {
          const rows = () => listFor(table).map((row) => ({ ...row }));
          const pending = {
            where() {
              return pending;
            },
            limit(n: number) {
              return Promise.resolve(rows().slice(0, n));
            },
            then(resolve: (value: Row[]) => void, reject?: (err: unknown) => void) {
              return Promise.resolve(rows()).then(resolve, reject);
            },
          };
          return pending;
        },
      };
    },
    insert(table: object) {
      return {
        values(value: Row) {
          if (box.throwDb) throw new Error('db down');
          const row = {
            id: `${table === users ? 'user' : 'idn'}-${listFor(table).length + 1}`,
            sessionVersion: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...value,
          };
          listFor(table).push(row);
          return { returning: () => Promise.resolve([row]) };
        },
      };
    },
    async transaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
      return fn(db);
    },
  };
  return db;
}

vi.mock('../db/index.js', () => ({
  getDb: () => {
    if (box.throwDb) throw new Error('db down');
    return memoryDb();
  },
}));

function enable(): void {
  cfg.OIDC_ISSUER = ISSUER;
  cfg.OIDC_CLIENT_ID = 'message-center';
  cfg.OIDC_CLIENT_SECRET = '1234567890abcdef';
  cfg.OIDC_REDIRECT_URI = `${ORIGIN}/api/auth/oidc/callback`;
  cfg.OIDC_AUDIENCE = 'message-center-api';
}

function disable(): void {
  cfg.OIDC_ISSUER = undefined;
  cfg.OIDC_CLIENT_ID = undefined;
  cfg.OIDC_CLIENT_SECRET = undefined;
  cfg.OIDC_REDIRECT_URI = undefined;
  cfg.OIDC_AUDIENCE = undefined;
}

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: secrets.cookie });
  app.decorate('db', {} as never);
  app.decorate('authenticate', async () => undefined);
  app.decorate('webDistRoot', '');
  registerAuthRoutes(app);
  await app.ready();
  return app;
}

function cookiePair(header: string | string[] | undefined, name: string): string | undefined {
  const list = Array.isArray(header) ? header : header ? [header] : [];
  const found = list.find((item) => item.startsWith(`${name}=`));
  return found?.split(';')[0];
}

describe('oidc routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    disable();
    box.nonce = '';
    box.email = 'new@example.com';
    box.throwDb = false;
    box.fetches = [];
    mem.users = [];
    mem.identities = [];
    resetOidcCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        box.fetches.push({
          url: String(url),
          ...(init?.redirect ? { redirect: String(init.redirect) } : {}),
        });
        if (String(url).includes('well-known')) {
          return new Response(
            JSON.stringify({
              issuer: ISSUER,
              authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
              token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
              jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
              id_token_signing_alg_values_supported: ['RS256'],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ access_token: 'access', id_token: 'id-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    app = await build();
  });

  it('hides the entry when unified login is not configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/oidc/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: false });
    expect(box.fetches).toHaveLength(0);
  });

  it('sends a disabled start back to login', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/oidc/start' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`${ORIGIN}/login`);
    expect(box.fetches).toHaveLength(0);
  });

  it('starts the authorization code flow with S256', async () => {
    enable();
    const res = await app.inject({ method: 'GET', url: '/api/auth/oidc/start?return=/messages' });
    expect(res.statusCode).toBe(302);
    const location = String(res.headers.location);
    expect(location.startsWith(`${ISSUER}/protocol/openid-connect/auth`)).toBe(true);
    expect(location).toContain('code_challenge_method=S256');
    expect(location).toContain('client_id=message-center');
    expect(cookiePair(res.headers['set-cookie'], OIDC_COOKIE)).toBeTruthy();
    expect(box.fetches[0]?.redirect).toBe('error');
  });

  it('rejects a mismatched state with a login redirect', async () => {
    enable();
    const tx = {
      state: 'abcd',
      nonce: 'nonce-value',
      verifier: 'verifier-value',
      returnTo: '/messages',
      iat: Math.floor(Date.now() / 1000),
    };
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oidc/callback?state=abc',
      headers: { cookie: `${OIDC_COOKIE}=${encodeURIComponent(app.signCookie(JSON.stringify(tx)))}` },
    });
    expect(res.statusCode).toBe(302);
    expect(String(res.headers.location)).toBe(`${ORIGIN}/login?oidc_error=OIDC_STATE`);
    expect(String(res.headers['set-cookie'] ?? '')).not.toContain('mc_at=');
  });

  it('signs in with cookies and creates a user without a password', async () => {
    enable();
    const tx = {
      state: 'same-state',
      nonce: 'nonce-value',
      verifier: 'verifier-value',
      returnTo: '/messages',
      iat: Math.floor(Date.now() / 1000),
    };
    box.nonce = tx.nonce;
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oidc/callback?state=same-state&code=abc',
      headers: { cookie: `${OIDC_COOKIE}=${encodeURIComponent(app.signCookie(JSON.stringify(tx)))}` },
    });
    expect(res.statusCode).toBe(302);
    expect(String(res.headers.location)).toBe(`${ORIGIN}/messages`);
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain('mc_at=');
    expect(setCookie).toContain('mc_rt=');
    expect(res.body).not.toContain('accessToken');
    expect(mem.users).toHaveLength(1);
    expect(mem.users[0]?.passwordHash).toBeNull();
    expect(mem.identities).toHaveLength(1);
  });

  it('does not attach a colliding email to the existing user', async () => {
    enable();
    mem.users.push({
      id: 'existing',
      email: 'new@example.com',
      passwordHash: 'hash',
      displayName: 'Old',
      sessionVersion: 3,
    });
    const tx = {
      state: 'same-state',
      nonce: 'nonce-value',
      verifier: 'verifier-value',
      returnTo: '/',
      iat: Math.floor(Date.now() / 1000),
    };
    box.nonce = tx.nonce;
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oidc/callback?state=same-state&code=abc',
      headers: { cookie: `${OIDC_COOKIE}=${encodeURIComponent(app.signCookie(JSON.stringify(tx)))}` },
    });
    expect(res.statusCode).toBe(302);
    expect(String(res.headers.location)).toContain('oidc_error=OIDC_EMAIL_CONFLICT');
    expect(mem.users).toHaveLength(1);
    expect(mem.identities).toHaveLength(0);
  });

  it('turns an unexpected failure into a redirect', async () => {
    enable();
    box.throwDb = true;
    const tx = {
      state: 'same-state',
      nonce: 'nonce-value',
      verifier: 'verifier-value',
      returnTo: '/messages',
      iat: Math.floor(Date.now() / 1000),
    };
    box.nonce = tx.nonce;
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oidc/callback?state=same-state&code=abc',
      headers: { cookie: `${OIDC_COOKIE}=${encodeURIComponent(app.signCookie(JSON.stringify(tx)))}` },
    });
    expect(res.statusCode).toBe(302);
    expect(String(res.headers.location)).toContain('oidc_error=OIDC_UNAVAILABLE');
    expect(String(res.headers['set-cookie'] ?? '')).not.toContain('mc_at=');
  });
});
