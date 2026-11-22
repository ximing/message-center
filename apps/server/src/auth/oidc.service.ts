import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, decodeProtectedHeader, errors, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { isUniqueViolation } from '../db/pg.js';
import { oidcIdentities, users, type UserRow } from '../db/schema.js';
import { issueAuthCookies } from './auth.service.js';
import { readSignedCookie } from './cookies.js';
import {
  allowedAlgs,
  audienceIncludes,
  codeChallengeS256,
  decideEmail,
  displayNameFromClaims,
  endpointAllowed,
  idTokenAccepts,
  resolveOidcConfig,
  sanitizeReturnTo,
  stateMatches,
  syntheticEmail,
  type OidcConfig,
  type OidcErrorCode,
} from './oidc-logic.js';

export const OIDC_COOKIE = 'mc_oidc';
const COOKIE_TTL_SECONDS = 600;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  id_token_signing_alg_values_supported?: string[];
};

type Tx = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  iat: number;
};

type DiscoveryCache = { issuer: string; doc: Discovery; at: number };

let discoveryCache: DiscoveryCache | null = null;
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function resetOidcCaches(): void {
  discoveryCache = null;
  jwksByIssuer.clear();
}

function web(path: string): string {
  return `${config.WEB_ORIGIN}${path}`;
}

export function oidcFailureLocation(code?: OidcErrorCode): string {
  if (!code) return web('/login');
  return web(`/login?oidc_error=${code}`);
}

export function clearOidcCookie(reply: FastifyReply): void {
  void reply.setCookie(OIDC_COOKIE, '', {
    httpOnly: true,
    path: '/api/auth/oidc',
    sameSite: 'lax',
    signed: true,
    secure: config.NODE_ENV === 'production',
    maxAge: 0,
  });
}

function writeOidcCookie(reply: FastifyReply, tx: Tx): void {
  void reply.setCookie(OIDC_COOKIE, JSON.stringify(tx), {
    httpOnly: true,
    path: '/api/auth/oidc',
    sameSite: 'lax',
    signed: true,
    secure: config.NODE_ENV === 'production',
    maxAge: COOKIE_TTL_SECONDS,
  });
}

function readTx(req: FastifyRequest): Tx | null {
  const raw = readSignedCookie(req, OIDC_COOKIE);
  if (!raw) return null;
  try {
    const tx = JSON.parse(raw) as Tx;
    if (!tx.state || !tx.nonce || !tx.verifier || typeof tx.iat !== 'number') return null;
    if (Date.now() / 1000 - tx.iat > COOKIE_TTL_SECONDS) return null;
    return tx;
  } catch {
    return null;
  }
}

function enabledConfig(): OidcConfig | null {
  const resolved = resolveOidcConfig(config);
  return resolved.enabled ? resolved.config : null;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
}

async function discovery(cfg: OidcConfig): Promise<Discovery> {
  if (discoveryCache && discoveryCache.issuer === cfg.issuer && Date.now() - discoveryCache.at < DISCOVERY_TTL_MS) {
    return discoveryCache.doc;
  }
  const response = await fetchJson(
    `${cfg.issuer}/.well-known/openid-configuration`,
    { headers: { accept: 'application/json' } },
    5000,
  );
  if (!response.ok) throw new Error(`discovery ${response.status}`);
  const doc = (await response.json()) as Discovery;
  if (doc.issuer !== cfg.issuer) throw new Error('issuer_mismatch');
  for (const endpoint of [doc.authorization_endpoint, doc.token_endpoint, doc.jwks_uri]) {
    if (!endpointAllowed(endpoint, cfg.issuer)) throw new Error('endpoint');
  }
  discoveryCache = { issuer: cfg.issuer, doc, at: Date.now() };
  return doc;
}

function jwks(doc: Discovery) {
  const cached = jwksByIssuer.get(doc.jwks_uri);
  if (cached) return cached;
  const set = createRemoteJWKSet(new URL(doc.jwks_uri), {
    timeoutDuration: 5000,
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  });
  jwksByIssuer.set(doc.jwks_uri, set);
  return set;
}

function mapVerifyError(err: unknown): OidcErrorCode {
  if (err instanceof errors.JWTExpired) return 'OIDC_STATE';
  if (err instanceof errors.JWTClaimValidationFailed) {
    if (err.claim === 'aud') return 'OIDC_AUDIENCE';
    if (err.claim === 'exp' || err.claim === 'nbf') return 'OIDC_STATE';
    if (err.claim === 'iss') return 'OIDC_UNAVAILABLE';
  }
  return 'OIDC_AUDIENCE';
}

async function verifyToken(
  token: string,
  doc: Discovery,
  cfg: OidcConfig,
  audience: string,
): Promise<{ payload: JWTPayload } | { error: OidcErrorCode; alg?: string }> {
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    return { error: 'OIDC_AUDIENCE' };
  }
  const algorithms = allowedAlgs(doc.id_token_signing_alg_values_supported);
  if (!alg || !algorithms.includes(alg)) return { error: 'OIDC_AUDIENCE', ...(alg ? { alg } : {}) };
  try {
    const verified = await jwtVerify(token, jwks(doc), {
      issuer: cfg.issuer,
      audience,
      algorithms,
      clockTolerance: 60,
    });
    return { payload: verified.payload };
  } catch (err) {
    return { error: mapVerifyError(err), alg };
  }
}

async function exchange(
  doc: Discovery,
  cfg: OidcConfig,
  code: string,
  verifier: string,
): Promise<{ access: string; id: string } | { error: OidcErrorCode }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    code_verifier: verifier,
    client_secret: cfg.clientSecret,
  });
  let response: Response;
  try {
    response = await fetchJson(
      doc.token_endpoint,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
      },
      10_000,
    );
  } catch {
    return { error: 'OIDC_UNAVAILABLE' };
  }
  if (!response.ok) {
    let error = '';
    try {
      error = String(((await response.json()) as { error?: string }).error ?? '');
    } catch {
      error = '';
    }
    if (error === 'invalid_grant' || error === 'access_denied') return { error: 'OIDC_DENIED' };
    return { error: 'OIDC_UNAVAILABLE' };
  }
  const tokens = (await response.json()) as { access_token?: string; id_token?: string };
  if (!tokens.access_token || !tokens.id_token) return { error: 'OIDC_DENIED' };
  return { access: tokens.access_token, id: tokens.id_token };
}

async function loginIdentity(
  cfg: OidcConfig,
  sub: string,
  claims: JWTPayload,
): Promise<{ user: UserRow; jit: boolean } | { error: OidcErrorCode }> {
  const db = getDb();
  const existing = await db
    .select()
    .from(oidcIdentities)
    .where(and(eq(oidcIdentities.issuer, cfg.issuer), eq(oidcIdentities.sub, sub)))
    .limit(1);
  const found = existing[0];
  if (found) {
    const [user] = await db.select().from(users).where(eq(users.id, found.userId)).limit(1);
    if (!user) return { error: 'OIDC_UNAVAILABLE' };
    return { user, jit: false };
  }
  const emailRaw = claims.email;
  const taken =
    typeof emailRaw === 'string' && emailRaw.trim().length > 0
      ? (
          await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, emailRaw.trim().toLowerCase()))
            .limit(1)
        ).length > 0
      : false;
  const decision = decideEmail(emailRaw, taken);
  if (decision.kind === 'invalid') return { error: 'OIDC_EMAIL_INVALID' };
  if (decision.kind === 'conflict') return { error: 'OIDC_EMAIL_CONFLICT' };
  const email = decision.kind === 'use' ? decision.email : syntheticEmail(cfg.issuer, sub);
  const displayName = displayNameFromClaims(claims.name, claims.preferred_username);
  try {
    return await db.transaction(async (tx) => {
      const [again] = await tx
        .select()
        .from(oidcIdentities)
        .where(and(eq(oidcIdentities.issuer, cfg.issuer), eq(oidcIdentities.sub, sub)))
        .limit(1);
      if (again) {
        const [user] = await tx.select().from(users).where(eq(users.id, again.userId)).limit(1);
        if (!user) throw new Error('missing user');
        return { user, jit: false };
      }
      const [user] = await tx.insert(users).values({ email, displayName, passwordHash: null }).returning();
      if (!user) throw new Error('insert user');
      await tx.insert(oidcIdentities).values({ userId: user.id, issuer: cfg.issuer, sub });
      return { user, jit: true };
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [raced] = await db
      .select()
      .from(oidcIdentities)
      .where(and(eq(oidcIdentities.issuer, cfg.issuer), eq(oidcIdentities.sub, sub)))
      .limit(1);
    if (raced) {
      const [user] = await db.select().from(users).where(eq(users.id, raced.userId)).limit(1);
      if (user) return { user, jit: false };
    }
    return { error: 'OIDC_EMAIL_CONFLICT' };
  }
}

function authorizeUrl(doc: Discovery, cfg: OidcConfig, tx: Tx): string {
  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('scope', cfg.scopes);
  url.searchParams.set('state', tx.state);
  url.searchParams.set('nonce', tx.nonce);
  url.searchParams.set('code_challenge', codeChallengeS256(tx.verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function oidcStatus(): { enabled: boolean } {
  return { enabled: enabledConfig() !== null };
}

export async function beginOidc(
  req: FastifyRequest,
  reply: FastifyReply,
  returnRaw: string | undefined,
): Promise<string> {
  const cfg = enabledConfig();
  if (!cfg) return web('/login');
  let doc: Discovery;
  try {
    doc = await discovery(cfg);
  } catch (err) {
    req.log.info({
      oidcError: 'OIDC_UNAVAILABLE',
      issuerHost: cfg.issuerHost,
      reason: err instanceof Error && err.message === 'issuer_mismatch' ? 'issuer_mismatch' : 'discovery',
    });
    return oidcFailureLocation('OIDC_UNAVAILABLE');
  }
  const tx: Tx = {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    returnTo: sanitizeReturnTo(returnRaw, config.WEB_ORIGIN),
    iat: Math.floor(Date.now() / 1000),
  };
  writeOidcCookie(reply, tx);
  return authorizeUrl(doc, cfg, tx);
}

export async function completeOidc(req: FastifyRequest, reply: FastifyReply): Promise<string> {
  const tx = readTx(req);
  clearOidcCookie(reply);
  const cfg = enabledConfig();
  const query = req.query as { code?: string; state?: string; error?: string };
  if (!cfg) return web('/login');
  const fail = (code: OidcErrorCode) => {
    req.log.info({ oidcError: code, issuerHost: cfg.issuerHost });
    return oidcFailureLocation(code);
  };
  if (!tx) return fail('OIDC_STATE');
  if (query.error) return fail('OIDC_DENIED');
  if (!stateMatches(tx.state, query.state)) return fail('OIDC_STATE');
  if (!query.code || query.code.length > 2048) return fail('OIDC_DENIED');

  let doc: Discovery;
  try {
    doc = await discovery(cfg);
  } catch (err) {
    req.log.info({
      oidcError: 'OIDC_UNAVAILABLE',
      issuerHost: cfg.issuerHost,
      reason: err instanceof Error && err.message === 'issuer_mismatch' ? 'issuer_mismatch' : 'discovery',
    });
    return oidcFailureLocation('OIDC_UNAVAILABLE');
  }
  const tokens = await exchange(doc, cfg, query.code, tx.verifier);
  if ('error' in tokens) return fail(tokens.error);
  const access = await verifyToken(tokens.access, doc, cfg, cfg.audience);
  if ('error' in access) return fail(access.error);
  const sub = access.payload.sub;
  if (typeof sub !== 'string' || sub.length === 0) return fail('OIDC_SUBJECT');
  if (!audienceIncludes(access.payload.aud, cfg.audience)) return fail('OIDC_AUDIENCE');
  const id = await verifyToken(tokens.id, doc, cfg, cfg.clientId);
  if ('error' in id) return fail(id.error);
  const idError = idTokenAccepts({
    aud: id.payload.aud,
    clientId: cfg.clientId,
    nonce: id.payload.nonce,
    expectedNonce: tx.nonce,
    sub: id.payload.sub,
    accessSub: sub,
  });
  if (idError) return fail(idError);

  const logged = await loginIdentity(cfg, sub, id.payload);
  if ('error' in logged) return fail(logged.error);
  req.log.info({ oidcError: null, jit: logged.jit, issuerHost: cfg.issuerHost });
  issueAuthCookies(reply, logged.user.id, logged.user.sessionVersion);
  return web(tx.returnTo);
}
