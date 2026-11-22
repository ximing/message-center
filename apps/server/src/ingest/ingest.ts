import {
  CONTENT_MAX_BYTES,
  type IngressChannel,
  type MessageKind,
  type WebhookIngestInput,
  type WechatIngestInput,
} from '@mc/dto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { isUniqueViolation } from '../db/pg.js';
import {
  connections,
  deliveries,
  forwardRules,
  inboundMessages,
  type ApiKeyRow,
  type InboundMessageRow,
} from '../db/schema.js';
import { AppError } from '../errors.js';
import { encodeLinkBody } from '../delivery/text.js';
import { touchApiKey } from '../keys/api-keys.js';
import { classifyWechatType, normalizeWechatMessage } from '../wechat/parse.js';
import { extractXmlTag } from '../wechat/xml.js';
import { positiveMsgSvrId, sha256Hex, webhookDedupPreimage, wechatDedupPreimage } from './dedup.js';
import { initialDelivery, selectRules } from './match.js';

export interface IngestView {
  id: string;
  ingress: IngressChannel;
  sender: string;
  room: string | null;
  kind: MessageKind;
  createdAt: string;
}

export interface IngestResult {
  created: boolean;
  message: IngestView;
}

function toView(row: InboundMessageRow): IngestView {
  return {
    id: row.id,
    ingress: row.ingress as IngressChannel,
    sender: row.sender,
    room: row.room,
    kind: row.kind as MessageKind,
    createdAt: row.createdAt.toISOString(),
  };
}

async function accept(input: {
  userId: string;
  apiKeyId: string;
  ingress: IngressChannel;
  dedupKey: string;
  sender: string;
  room: string | null;
  kind: MessageKind;
  body: string;
  rawRef: string | null;
}): Promise<IngestResult> {
  const db = getDb();
  const rules = await db.select().from(forwardRules).where(eq(forwardRules.userId, input.userId));
  const chosen = selectRules(rules, input);
  const connectionIds = [...new Set(chosen.map((rule) => rule.connectionId))];
  const owned =
    connectionIds.length === 0
      ? []
      : await db
          .select()
          .from(connections)
          .where(and(eq(connections.userId, input.userId), inArray(connections.id, connectionIds)));
  const byId = new Map(owned.map((row) => [row.id, row]));

  try {
    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(inboundMessages)
        .values({
          userId: input.userId,
          ingress: input.ingress,
          apiKeyId: input.apiKeyId,
          dedupKey: input.dedupKey,
          sender: input.sender,
          room: input.room,
          kind: input.kind,
          body: input.body,
          rawRef: input.rawRef,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw AppError.of(500, 'INTERNAL_ERROR');
      const planned = chosen.flatMap((rule) => {
        const connection = byId.get(rule.connectionId);
        if (!connection) return [];
        const initial = initialDelivery(input.kind, connection);
        return [
          {
            messageId: row.id,
            ruleId: rule.id,
            connectionId: connection.id,
            status: initial.status,
            skipReason: initial.skipReason,
          },
        ];
      });
      if (planned.length > 0) await tx.insert(deliveries).values(planned);
      return row;
    });
    return { created: true, message: toView(created) };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (!isUniqueViolation(err)) throw err;
    const [existing] = await db
      .select()
      .from(inboundMessages)
      .where(and(eq(inboundMessages.userId, input.userId), eq(inboundMessages.dedupKey, input.dedupKey)))
      .limit(1);
    if (!existing) throw err;
    return { created: false, message: toView(existing) };
  }
}

export async function ingestWechat(key: ApiKeyRow, input: WechatIngestInput): Promise<IngestResult> {
  if (Buffer.byteLength(input.content, 'utf8') > CONTENT_MAX_BYTES) {
    throw AppError.of(413, 'CONTENT_TOO_LARGE');
  }
  if (input.isSend !== 0) throw AppError.of(400, 'VALIDATION_ERROR');
  const kind = classifyWechatType(input.type);
  if (!kind) throw AppError.of(400, 'VALIDATION_ERROR');
  const normalized = normalizeWechatMessage({
    talker: input.talker,
    fromUser: input.fromUser,
    content: input.content,
  });
  if ((kind === 'text' || kind === 'link') && normalized.body.length === 0) {
    throw AppError.of(400, 'VALIDATION_ERROR');
  }
  let body = normalized.body;
  if (kind === 'link') {
    const url = extractXmlTag(normalized.body, 'url');
    const title = extractXmlTag(normalized.body, 'title');
    if (url) body = encodeLinkBody({ title, url, text: '' });
  }
  await touchApiKey(key.id);
  const preimage = wechatDedupPreimage({
    talker: input.talker,
    type: input.type,
    msgSvrId: input.msgSvrId,
    createTime: input.createTime,
    content: input.content,
  });
  return accept({
    userId: key.userId,
    apiKeyId: key.id,
    ingress: 'wechat',
    dedupKey: sha256Hex(preimage),
    sender: normalized.sender,
    room: normalized.room,
    kind,
    body,
    rawRef: positiveMsgSvrId(input.msgSvrId) ? input.msgSvrId : `ct:${input.createTime}`,
  });
}

export async function ingestWebhook(key: ApiKeyRow, input: WebhookIngestInput): Promise<IngestResult> {
  const sender = input.sender.trim();
  if (!sender) throw AppError.of(400, 'VALIDATION_ERROR');
  const text = input.text?.trim() ?? '';
  const url = input.url?.trim() ?? '';
  const title = input.title?.trim() ?? '';
  if (input.kind === 'text' && text.length === 0) throw AppError.of(400, 'VALIDATION_ERROR');
  if (input.kind === 'link' && url.length === 0) throw AppError.of(400, 'VALIDATION_ERROR');
  if (Buffer.byteLength(text, 'utf8') > CONTENT_MAX_BYTES) throw AppError.of(413, 'CONTENT_TOO_LARGE');
  const room = input.room?.trim() ? input.room.trim() : null;
  const body =
    input.kind === 'link'
      ? encodeLinkBody({ title, url, text })
      : text;
  await touchApiKey(key.id);
  return accept({
    userId: key.userId,
    apiKeyId: key.id,
    ingress: 'webhook',
    dedupKey: sha256Hex(webhookDedupPreimage(input.eventId)),
    sender,
    room,
    kind: input.kind,
    body,
    rawRef: input.eventId.slice(0, 512),
  });
}
