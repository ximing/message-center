import {
  API_KEY_MAX_PER_USER,
  type CreateApiKeyInput,
  type PatchApiKeyInput,
} from "@mc/dto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../crypto.js";
import { getDb } from "../db/index.js";
import { apiKeys, type ApiKeyRow } from "../db/schema.js";
import { AppError } from "../errors.js";
import {
  generateApiKey,
  hashApiKey,
  isAccountKey,
  previewSecret,
} from "./api-key-logic.js";

export interface PublicApiKey {
  id: string;
  name: string;
  note: string;
  preview: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function toPublic(row: ApiKeyRow): PublicApiKey {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    preview: row.tokenPreview,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export async function listApiKeys(userId: string): Promise<PublicApiKey[]> {
  const rows = await getDb()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map(toPublic);
}

export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput,
): Promise<PublicApiKey & { token: string }> {
  const db = getDb();
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  if (Number(countRow?.count ?? 0) >= API_KEY_MAX_PER_USER)
    throw AppError.of(409, "API_KEY_LIMIT");

  const token = generateApiKey();
  const inserted = await db
    .insert(apiKeys)
    .values({
      userId,
      name: input.name,
      note: input.note,
      tokenHash: hashApiKey(token),
      tokenEncrypted: encryptSecret(token),
      tokenPreview: previewSecret(token),
    })
    .returning();
  const row = inserted[0];
  if (!row) throw AppError.of(500, "INTERNAL_ERROR");
  return { ...toPublic(row), token };
}

export async function revealApiKey(
  userId: string,
  id: string,
): Promise<{ token: string }> {
  const [row] = await getDb()
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .limit(1);
  if (!row) throw AppError.of(404, "API_KEY_NOT_FOUND");
  const token = decryptSecret(row.tokenEncrypted);
  if (!token) throw AppError.of(500, "INTERNAL_ERROR");
  return { token };
}

export async function updateApiKey(
  userId: string,
  id: string,
  input: PatchApiKeyInput,
): Promise<PublicApiKey> {
  const [row] = await getDb()
    .update(apiKeys)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning();
  if (!row) throw AppError.of(404, "API_KEY_NOT_FOUND");
  return toPublic(row);
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  const updated = await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });
  if (updated.length === 0) throw AppError.of(404, "API_KEY_NOT_FOUND");
}

export async function touchApiKey(id: string): Promise<void> {
  await getDb()
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id));
}

export async function findActiveApiKey(
  token: string,
): Promise<ApiKeyRow | undefined> {
  if (!isAccountKey(token)) return undefined;
  const [row] = await getDb()
    .select()
    .from(apiKeys)
    .where(
      and(eq(apiKeys.tokenHash, hashApiKey(token)), isNull(apiKeys.revokedAt)),
    )
    .limit(1);
  return row;
}
