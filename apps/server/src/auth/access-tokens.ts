import {
  ACCESS_TOKEN_MAX_PER_USER,
  type CreateAccessTokenInput,
  type PatchAccessTokenInput,
} from '@mc/dto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { decryptSecret, encryptSecret } from '../crypto.js';
import { getDb } from '../db/index.js';
import { accessTokens, users, type AccessTokenRow } from '../db/schema.js';
import { AppError } from '../errors.js';
import {
  generateAccessToken,
  hashAccessToken,
  previewAccessToken,
} from './access-token-logic.js';

export interface PublicAccessToken {
  id: string;
  name: string;
  preview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function toPublic(row: AccessTokenRow): PublicAccessToken {
  return {
    id: row.id,
    name: row.name,
    preview: row.tokenPreview,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export async function listAccessTokens(userId: string): Promise<PublicAccessToken[]> {
  const rows = await getDb()
    .select()
    .from(accessTokens)
    .where(and(eq(accessTokens.userId, userId), isNull(accessTokens.revokedAt)))
    .orderBy(desc(accessTokens.createdAt));
  return rows.map(toPublic);
}

export async function createAccessToken(
  userId: string,
  input: CreateAccessTokenInput,
): Promise<PublicAccessToken & { token: string }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${userId} for update`);
    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(accessTokens)
      .where(and(eq(accessTokens.userId, userId), isNull(accessTokens.revokedAt)));
    if (Number(countRow?.count ?? 0) >= ACCESS_TOKEN_MAX_PER_USER) {
      throw AppError.of(409, 'ACCESS_TOKEN_LIMIT');
    }

    const token = generateAccessToken();
    const inserted = await tx
      .insert(accessTokens)
      .values({
        userId,
        name: input.name,
        tokenHash: hashAccessToken(token),
        tokenEncrypted: encryptSecret(token),
        tokenPreview: previewAccessToken(token),
      })
      .returning();
    const row = inserted[0];
    if (!row) throw AppError.of(500, 'INTERNAL_ERROR');
    return { ...toPublic(row), token };
  });
}

export async function revealAccessToken(
  userId: string,
  id: string,
): Promise<{ token: string }> {
  const [row] = await getDb()
    .select()
    .from(accessTokens)
    .where(
      and(eq(accessTokens.id, id), eq(accessTokens.userId, userId), isNull(accessTokens.revokedAt)),
    )
    .limit(1);
  if (!row) throw AppError.of(404, 'ACCESS_TOKEN_NOT_FOUND');
  const token = decryptSecret(row.tokenEncrypted);
  if (!token) throw AppError.of(500, 'INTERNAL_ERROR');
  return { token };
}

export async function updateAccessToken(
  userId: string,
  id: string,
  input: PatchAccessTokenInput,
): Promise<PublicAccessToken> {
  const [row] = await getDb()
    .update(accessTokens)
    .set({ name: input.name })
    .where(
      and(eq(accessTokens.id, id), eq(accessTokens.userId, userId), isNull(accessTokens.revokedAt)),
    )
    .returning();
  if (!row) throw AppError.of(404, 'ACCESS_TOKEN_NOT_FOUND');
  return toPublic(row);
}

export async function revokeAccessToken(userId: string, id: string): Promise<void> {
  const updated = await getDb()
    .update(accessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(accessTokens.id, id), eq(accessTokens.userId, userId), isNull(accessTokens.revokedAt)),
    )
    .returning({ id: accessTokens.id });
  if (updated.length === 0) throw AppError.of(404, 'ACCESS_TOKEN_NOT_FOUND');
}

export async function touchAccessToken(id: string): Promise<void> {
  await getDb()
    .update(accessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(accessTokens.id, id));
}

export async function findActiveAccessToken(
  token: string,
): Promise<{ id: string; userId: string } | undefined> {
  const [row] = await getDb()
    .select({ id: accessTokens.id, userId: accessTokens.userId })
    .from(accessTokens)
    .innerJoin(users, eq(users.id, accessTokens.userId))
    .where(and(eq(accessTokens.tokenHash, hashAccessToken(token)), isNull(accessTokens.revokedAt)))
    .limit(1);
  return row;
}
