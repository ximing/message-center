import type { AuthMode, AuthResponse, LoginInput, PublicUser, RegisterInput } from '@mc/dto';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { isUniqueViolation } from '../db/pg.js';
import { users, type UserRow } from '../db/schema.js';
import { AppError } from '../errors.js';
import { tokensForMode } from './auth-logic.js';
import { headerString, readBearerToken } from './bearer.js';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  readSignedCookie,
  setAccessCookie,
  setRefreshCookie,
} from './cookies.js';
import { hashPassword, verifyPassword } from './password.js';
import { signAccessToken, signRefreshToken, verifyToken } from './token.js';

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName ?? null,
  };
}

export async function getUserById(userId: string): Promise<UserRow> {
  const [row] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw AppError.of(401, 'INVALID_TOKEN');
  return row;
}

function signPair(userId: string, sessionVersion: number): { accessToken: string; refreshToken: string } {
  return {
    accessToken: signAccessToken(userId, sessionVersion),
    refreshToken: signRefreshToken(userId, sessionVersion),
  };
}

export function issueAuthCookies(reply: FastifyReply, userId: string, sessionVersion: number): void {
  const issued = signPair(userId, sessionVersion);
  setAccessCookie(reply, issued.accessToken);
  setRefreshCookie(reply, issued.refreshToken);
}

function issueAuthForMode(
  reply: FastifyReply,
  userId: string,
  sessionVersion: number,
  mode: AuthMode,
): { accessToken: string; refreshToken: string } {
  const issued = signPair(userId, sessionVersion);
  if (mode === 'cookie') {
    setAccessCookie(reply, issued.accessToken);
    setRefreshCookie(reply, issued.refreshToken);
  }
  return issued;
}

export async function issueAuthResponse(
  reply: FastifyReply,
  row: UserRow,
  mode: AuthMode,
): Promise<AuthResponse> {
  const issued = issueAuthForMode(reply, row.id, row.sessionVersion, mode);
  return {
    user: toPublicUser(row),
    tokens: tokensForMode(mode, { ...issued, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS }),
  };
}

async function authResponse(row: UserRow, mode: AuthMode): Promise<AuthResponse> {
  const issued = signPair(row.id, row.sessionVersion);
  return {
    user: toPublicUser(row),
    tokens: tokensForMode(mode, { ...issued, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS }),
  };
}

export async function registerUser(
  input: RegisterInput,
  reply: FastifyReply,
  mode: AuthMode,
): Promise<AuthResponse> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw AppError.of(409, 'EMAIL_ALREADY_REGISTERED');
  try {
    const inserted = await getDb().insert(users).values({ email, passwordHash }).returning();
    const row = inserted[0];
    if (!row) throw AppError.of(500, 'INTERNAL_ERROR');
    return issueAuthResponse(reply, row, mode);
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isUniqueViolation(err)) throw AppError.of(409, 'EMAIL_ALREADY_REGISTERED');
    throw err;
  }
}

export async function loginUser(
  input: LoginInput,
  reply: FastifyReply,
  mode: AuthMode,
): Promise<AuthResponse> {
  const email = input.email.trim().toLowerCase();
  const [row] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  if (!row?.passwordHash || !(await verifyPassword(input.password, row.passwordHash))) {
    throw AppError.of(401, 'INVALID_CREDENTIALS');
  }
  return issueAuthResponse(reply, row, mode);
}

export async function refreshBearer(refreshToken: string): Promise<AuthResponse> {
  const { userId, sessionVersion } = verifyToken(refreshToken, 'refresh');
  const row = await getUserById(userId);
  if (row.sessionVersion !== sessionVersion) throw AppError.of(401, 'INVALID_TOKEN');
  return authResponse(row, 'bearer');
}

async function bumpSession(token: string, kind: 'access' | 'refresh'): Promise<boolean> {
  try {
    const { userId, sessionVersion } = verifyToken(token, kind);
    const updated = await getDb()
      .update(users)
      .set({
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.sessionVersion, sessionVersion)))
      .returning({ id: users.id });
    return updated.length > 0;
  } catch {
    return false;
  }
}

function refreshFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as { refreshToken?: unknown }).refreshToken;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Bump sessionVersion when the presented cookie or bearer still matches. Never throws. */
export async function logoutSession(req: FastifyRequest): Promise<void> {
  const refresh = readSignedCookie(req, REFRESH_COOKIE_NAME);
  const access = readSignedCookie(req, ACCESS_COOKIE_NAME);
  if (refresh) {
    if (await bumpSession(refresh, 'refresh')) return;
  } else if (access) {
    if (await bumpSession(access, 'access')) return;
  }

  const bearer = readBearerToken(headerString(req.headers.authorization));
  if (bearer) {
    if (await bumpSession(bearer, 'access')) return;
    if (await bumpSession(bearer, 'refresh')) return;
  }

  const bodyRefresh = refreshFromBody(req.body);
  if (bodyRefresh) await bumpSession(bodyRefresh, 'refresh');
}

export async function getMe(userId: string): Promise<PublicUser> {
  return toPublicUser(await getUserById(userId));
}
