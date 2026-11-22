import type { CreateRuleInput, IngressChannel, PatchRuleInput } from "@mc/dto";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { isForeignKeyViolation } from "../db/pg.js";
import {
  connections,
  forwardRules,
  type ForwardRuleRow,
} from "../db/schema.js";
import { AppError } from "../errors.js";

export interface PublicRule {
  id: string;
  name: string;
  enabled: boolean;
  exclusive: boolean;
  matchIngress: IngressChannel | null;
  matchRoom: string | null;
  matchSender: string | null;
  connectionId: string;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toPublic(row: ForwardRuleRow): PublicRule {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    exclusive: row.exclusive,
    matchIngress: (row.matchIngress as IngressChannel | null) ?? null,
    matchRoom: row.matchRoom,
    matchSender: row.matchSender,
    connectionId: row.connectionId,
  };
}

async function assertOwnedConnection(
  userId: string,
  connectionId: string,
): Promise<void> {
  const [row] = await getDb()
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(eq(connections.id, connectionId), eq(connections.userId, userId)),
    )
    .limit(1);
  if (!row) throw AppError.of(400, "VALIDATION_ERROR");
}

export async function listRules(userId: string): Promise<PublicRule[]> {
  const rows = await getDb()
    .select()
    .from(forwardRules)
    .where(eq(forwardRules.userId, userId))
    .orderBy(asc(forwardRules.createdAt));
  return rows.map(toPublic);
}

export async function createRule(
  userId: string,
  input: CreateRuleInput,
): Promise<PublicRule> {
  await assertOwnedConnection(userId, input.connectionId);
  const inserted = await getDb()
    .insert(forwardRules)
    .values({
      userId,
      name: input.name,
      enabled: input.enabled ?? true,
      exclusive: input.exclusive ?? false,
      matchIngress: input.matchIngress ?? null,
      matchRoom: emptyToNull(input.matchRoom),
      matchSender: emptyToNull(input.matchSender),
      connectionId: input.connectionId,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw AppError.of(500, "INTERNAL_ERROR");
  return toPublic(row);
}

export async function updateRule(
  userId: string,
  id: string,
  input: PatchRuleInput,
): Promise<PublicRule> {
  const [existing] = await getDb()
    .select()
    .from(forwardRules)
    .where(and(eq(forwardRules.id, id), eq(forwardRules.userId, userId)))
    .limit(1);
  if (!existing) throw AppError.of(404, "RULE_NOT_FOUND");
  if (input.connectionId !== undefined)
    await assertOwnedConnection(userId, input.connectionId);

  const patch: {
    name?: string;
    enabled?: boolean;
    exclusive?: boolean;
    matchIngress?: string | null;
    matchRoom?: string | null;
    matchSender?: string | null;
    connectionId?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.exclusive !== undefined) patch.exclusive = input.exclusive;
  if (input.matchIngress !== undefined) patch.matchIngress = input.matchIngress;
  if (input.matchRoom !== undefined)
    patch.matchRoom = emptyToNull(input.matchRoom);
  if (input.matchSender !== undefined)
    patch.matchSender = emptyToNull(input.matchSender);
  if (input.connectionId !== undefined) patch.connectionId = input.connectionId;

  const updated = await getDb()
    .update(forwardRules)
    .set(patch)
    .where(and(eq(forwardRules.id, id), eq(forwardRules.userId, userId)))
    .returning();
  const row = updated[0];
  if (!row) throw AppError.of(404, "RULE_NOT_FOUND");
  return toPublic(row);
}

export async function deleteRule(userId: string, id: string): Promise<void> {
  try {
    const removed = await getDb()
      .delete(forwardRules)
      .where(and(eq(forwardRules.id, id), eq(forwardRules.userId, userId)))
      .returning({ id: forwardRules.id });
    if (removed.length === 0) throw AppError.of(404, "RULE_NOT_FOUND");
  } catch (err) {
    if (isForeignKeyViolation(err)) throw AppError.of(409, "RULE_IN_USE");
    throw err;
  }
}
