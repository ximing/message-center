import type { CreateConnectionInput, EgressProvider, PatchConnectionInput } from '@mc/dto';
import { and, desc, eq } from 'drizzle-orm';
import { decryptSecret, encryptSecret } from '../crypto.js';
import { getDb } from '../db/index.js';
import { isForeignKeyViolation } from '../db/pg.js';
import { connections, type ConnectionRow } from '../db/schema.js';
import { AppError } from '../errors.js';
import { bumpLiveRevision } from '../live/revision.js';
import { outboundFetch, requestJson } from '../http/outbound.js';
import { readRemoteIdentity, verifyPath } from './identity.js';
import { resolveApiBase, tokenPrefixOk } from './origin.js';
import { previewSecret } from '../keys/api-key-logic.js';

export interface PublicConnection {
  id: string;
  provider: EgressProvider;
  label: string;
  apiBase: string;
  preview: string;
  remoteUserId: string;
  remoteDisplayName: string | null;
  status: string;
  allowImage: boolean;
  allowVoice: boolean;
}

function toPublic(row: ConnectionRow): PublicConnection {
  return {
    id: row.id,
    provider: row.provider as EgressProvider,
    label: row.label,
    apiBase: row.apiBase,
    preview: row.tokenPreview,
    remoteUserId: row.remoteUserId,
    remoteDisplayName: row.remoteDisplayName,
    status: row.status,
    allowImage: row.allowImage,
    allowVoice: row.allowVoice,
  };
}

export async function verifyConnectionToken(
  provider: EgressProvider,
  apiBase: string,
  token: string,
): Promise<{ remoteUserId: string; remoteDisplayName: string | null }> {
  if (!tokenPrefixOk(provider, token)) throw AppError.of(400, 'CONNECTION_REJECTED');
  const result = await requestJson(
    outboundFetch,
    `${apiBase}${verifyPath(provider)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    15_000,
  );
  if ('io' in result || result.status < 200 || result.status >= 300) {
    throw AppError.of(400, 'CONNECTION_REJECTED');
  }
  const identity = readRemoteIdentity(provider, result.json);
  if (!identity) throw AppError.of(400, 'CONNECTION_REJECTED');
  return identity;
}

export async function listConnections(userId: string): Promise<PublicConnection[]> {
  const rows = await getDb()
    .select()
    .from(connections)
    .where(eq(connections.userId, userId))
    .orderBy(desc(connections.createdAt));
  return rows.map(toPublic);
}

export async function createConnection(
  userId: string,
  input: CreateConnectionInput,
): Promise<PublicConnection> {
  const apiBase = resolveApiBase(input.provider, input.apiBase);
  if (!apiBase) throw AppError.of(400, 'VALIDATION_ERROR');
  const identity = await verifyConnectionToken(input.provider, apiBase, input.token);
  const inserted = await getDb()
    .insert(connections)
    .values({
      userId,
      provider: input.provider,
      label: input.label,
      apiBase,
      tokenEncrypted: encryptSecret(input.token),
      tokenPreview: previewSecret(input.token),
      remoteUserId: identity.remoteUserId,
      remoteDisplayName: identity.remoteDisplayName,
      status: 'active',
      allowImage: input.allowImage ?? false,
      allowVoice: input.allowVoice ?? false,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw AppError.of(500, 'INTERNAL_ERROR');
  await bumpLiveRevision(getDb(), userId);
  return toPublic(row);
}

export async function updateConnection(
  userId: string,
  id: string,
  input: PatchConnectionInput,
): Promise<PublicConnection> {
  const [existing] = await getDb()
    .select()
    .from(connections)
    .where(and(eq(connections.id, id), eq(connections.userId, userId)))
    .limit(1);
  if (!existing) throw AppError.of(404, 'CONNECTION_NOT_FOUND');

  const patch: {
    label?: string;
    allowImage?: boolean;
    allowVoice?: boolean;
    tokenEncrypted?: string;
    tokenPreview?: string;
    remoteUserId?: string;
    remoteDisplayName?: string | null;
    status?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.label !== undefined) patch.label = input.label;
  if (input.allowImage !== undefined) patch.allowImage = input.allowImage;
  if (input.allowVoice !== undefined) patch.allowVoice = input.allowVoice;
  if (input.token !== undefined) {
    const identity = await verifyConnectionToken(
      existing.provider as EgressProvider,
      existing.apiBase,
      input.token,
    );
    patch.tokenEncrypted = encryptSecret(input.token);
    patch.tokenPreview = previewSecret(input.token);
    patch.remoteUserId = identity.remoteUserId;
    patch.remoteDisplayName = identity.remoteDisplayName;
    patch.status = 'active';
  }

  const updated = await getDb()
    .update(connections)
    .set(patch)
    .where(and(eq(connections.id, id), eq(connections.userId, userId)))
    .returning();
  const row = updated[0];
  if (!row) throw AppError.of(404, 'CONNECTION_NOT_FOUND');
  await bumpLiveRevision(getDb(), userId);
  return toPublic(row);
}

export async function deleteConnection(userId: string, id: string): Promise<void> {
  try {
    const removed = await getDb()
      .delete(connections)
      .where(and(eq(connections.id, id), eq(connections.userId, userId)))
      .returning({ id: connections.id });
    if (removed.length === 0) throw AppError.of(404, 'CONNECTION_NOT_FOUND');
    await bumpLiveRevision(getDb(), userId);
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isForeignKeyViolation(err)) throw AppError.of(409, 'CONNECTION_IN_USE');
    throw err;
  }
}

export function connectionToken(row: ConnectionRow): string | null {
  return decryptSecret(row.tokenEncrypted);
}
