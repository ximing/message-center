import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRow } from '../db/schema.js';
import { AppError } from '../errors.js';
import type { AuthPrincipal } from '../types.js';
import { getUserById, issueAuthCookies } from './auth.service.js';
import { headerString, readBearerToken } from './bearer.js';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, readSignedCookie } from './cookies.js';
import { verifyToken } from './token.js';

async function userFromToken(
  token: string,
  type: 'access' | 'refresh',
): Promise<UserRow | undefined> {
  try {
    const { userId, sessionVersion } = verifyToken(token, type);
    const user = await getUserById(userId);
    if (user.sessionVersion !== sessionVersion) return undefined;
    return user;
  } catch {
    return undefined;
  }
}

/** Bearer access JWT, else access cookie (refresh cookie silently rotates it). */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const bearer = readBearerToken(headerString(req.headers.authorization));
  if (bearer) {
    const user = await userFromToken(bearer, 'access');
    if (user) {
      req.user = { id: user.id };
      return;
    }
    throw AppError.of(401, 'INVALID_TOKEN');
  }

  const access = readSignedCookie(req, ACCESS_COOKIE_NAME);
  if (access) {
    const user = await userFromToken(access, 'access');
    if (user) {
      req.user = { id: user.id };
      return;
    }
  }

  const refresh = readSignedCookie(req, REFRESH_COOKIE_NAME);
  if (refresh) {
    const user = await userFromToken(refresh, 'refresh');
    if (user) {
      issueAuthCookies(reply, user.id, user.sessionVersion);
      req.user = { id: user.id };
      return;
    }
  }

  throw AppError.of(401, 'INVALID_TOKEN');
}

export function requireUser(req: FastifyRequest): AuthPrincipal {
  const user = req.user;
  if (!user) throw AppError.of(401, 'INVALID_TOKEN');
  return user;
}
