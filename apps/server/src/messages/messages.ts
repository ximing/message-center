import type { IngressChannel, MessageKind } from "@mc/dto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  connections,
  deliveries,
  inboundMessages,
  type DeliveryRow,
  type InboundMessageRow,
} from "../db/schema.js";
import { AppError } from "../errors.js";

export interface MessageSummary {
  id: string;
  ingress: IngressChannel;
  sender: string;
  room: string | null;
  kind: MessageKind;
  createdAt: string;
  apiKeyId: string | null;
}

export interface PublicDelivery {
  id: string;
  ruleId: string | null;
  connectionId: string;
  provider: string;
  status: string;
  skipReason: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  remoteId: string | null;
  httpStatus: number | null;
  errorCode: string | null;
}

function toSummary(row: InboundMessageRow): MessageSummary {
  return {
    id: row.id,
    ingress: row.ingress as IngressChannel,
    sender: row.sender,
    room: row.room,
    kind: row.kind as MessageKind,
    createdAt: row.createdAt.toISOString(),
    apiKeyId: row.apiKeyId,
  };
}

function toDelivery(row: DeliveryRow, provider: string): PublicDelivery {
  return {
    id: row.id,
    ruleId: row.ruleId,
    connectionId: row.connectionId,
    provider,
    status: row.status,
    skipReason: row.skipReason,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    remoteId: row.remoteId,
    httpStatus: row.httpStatus,
    errorCode: row.errorCode,
  };
}

export async function listMessages(
  userId: string,
): Promise<Array<MessageSummary & { deliveries: PublicDelivery[] }>> {
  const rows = await getDb()
    .select({
      id: inboundMessages.id,
      ingress: inboundMessages.ingress,
      sender: inboundMessages.sender,
      room: inboundMessages.room,
      kind: inboundMessages.kind,
      createdAt: inboundMessages.createdAt,
      apiKeyId: inboundMessages.apiKeyId,
    })
    .from(inboundMessages)
    .where(eq(inboundMessages.userId, userId))
    .orderBy(desc(inboundMessages.createdAt))
    .limit(200);
  if (rows.length === 0) return [];
  // Batch delivery metadata for this user's latest messages; never read bodies here.
  const results = await getDb()
    .select({ delivery: deliveries, provider: connections.provider })
    .from(deliveries)
    .innerJoin(
      connections,
      and(
        eq(connections.id, deliveries.connectionId),
        eq(connections.userId, userId),
      ),
    )
    .where(
      inArray(
        deliveries.messageId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(deliveries.createdAt));
  const byMessage = new Map<string, PublicDelivery[]>();
  for (const { delivery, provider } of results) {
    const list = byMessage.get(delivery.messageId) ?? [];
    list.push(toDelivery(delivery, provider));
    byMessage.set(delivery.messageId, list);
  }
  return rows.map((row) => ({
    ...row,
    ingress: row.ingress as IngressChannel,
    kind: row.kind as MessageKind,
    createdAt: row.createdAt.toISOString(),
    deliveries: byMessage.get(row.id) ?? [],
  }));
}

export async function getMessage(
  userId: string,
  id: string,
): Promise<MessageSummary & { body: string; deliveries: PublicDelivery[] }> {
  const [row] = await getDb()
    .select()
    .from(inboundMessages)
    .where(and(eq(inboundMessages.id, id), eq(inboundMessages.userId, userId)))
    .limit(1);
  if (!row) throw AppError.of(404, "MESSAGE_NOT_FOUND");
  const rows = await getDb()
    .select()
    .from(deliveries)
    .where(eq(deliveries.messageId, row.id))
    .orderBy(asc(deliveries.createdAt));
  const connectionIds = [...new Set(rows.map((item) => item.connectionId))];
  const owned =
    connectionIds.length === 0
      ? []
      : await getDb()
          .select({ id: connections.id, provider: connections.provider })
          .from(connections)
          .where(inArray(connections.id, connectionIds));
  const providerById = new Map(owned.map((item) => [item.id, item.provider]));
  return {
    ...toSummary(row),
    body: row.body,
    deliveries: rows.map((item) =>
      toDelivery(item, providerById.get(item.connectionId) ?? ""),
    ),
  };
}
