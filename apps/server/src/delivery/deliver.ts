import type { EgressProvider, IngressChannel, MessageKind } from '@mc/dto';
import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { decryptSecret } from '../crypto.js';
import { getDb } from '../db/index.js';
import { connections, deliveries, inboundMessages } from '../db/schema.js';
import type { FetchLike } from '../http/outbound.js';
import { deliverToProvider, type ProviderOptions } from './providers.js';
import { shouldRetry } from './retry.js';

export interface DeliverQueuedDeps extends ProviderOptions {
  fetch: FetchLike;
  userId?: string;
  now?: Date;
  limit?: number;
}

function logDelivery(fields: {
  connectionId: string;
  provider: string;
  status: string;
  sender: string;
  room: string;
  errorCode: string;
}): void {
  if (process.env.NODE_ENV === 'test') return;
  console.info(JSON.stringify({ scope: 'delivery', ...fields }));
}

export async function deliverQueued(deps: DeliverQueuedDeps): Promise<void> {
  const db = getDb();
  const now = deps.now ?? new Date();
  const due = or(isNull(deliveries.nextAttemptAt), lte(deliveries.nextAttemptAt, now));
  const where = deps.userId
    ? and(eq(deliveries.status, 'queued'), due, eq(inboundMessages.userId, deps.userId))
    : and(eq(deliveries.status, 'queued'), due);
  const rows = await db
    .select({
      delivery: deliveries,
      message: inboundMessages,
      connection: connections,
    })
    .from(deliveries)
    .innerJoin(inboundMessages, eq(deliveries.messageId, inboundMessages.id))
    .innerJoin(connections, eq(deliveries.connectionId, connections.id))
    .where(where)
    .orderBy(asc(deliveries.createdAt))
    .limit(deps.limit ?? 50);

  const stopped = new Set<string>();
  for (const row of rows) {
    const deliveryId = row.delivery.id;
    const connectionId = row.connection.id;
    const sender = row.message.sender;
    const room = row.message.room ?? '';
    const provider = row.connection.provider;

    if (row.connection.status !== 'active' || stopped.has(connectionId)) {
      await db
        .update(deliveries)
        .set({
          status: 'failed',
          errorCode: 'unauthorized',
          attempts: sql`${deliveries.attempts} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(deliveries.id, deliveryId), eq(deliveries.status, 'queued')));
      logDelivery({ connectionId, provider, status: 'failed', sender, room, errorCode: 'unauthorized' });
      continue;
    }

    const kind = row.message.kind as MessageKind;
    if (kind !== 'text' && kind !== 'link') {
      await db
        .update(deliveries)
        .set({
          status: 'failed',
          errorCode: 'media_not_sent',
          updatedAt: new Date(),
        })
        .where(and(eq(deliveries.id, deliveryId), eq(deliveries.status, 'queued')));
      continue;
    }

    const claimUntil = new Date(now.getTime() + 5 * 60_000);
    const claimed = await db
      .update(deliveries)
      .set({ nextAttemptAt: claimUntil, updatedAt: new Date() })
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.status, 'queued'), due))
      .returning({ id: deliveries.id });
    if (claimed.length === 0) continue;

    const token = decryptSecret(row.connection.tokenEncrypted);
    if (!token) {
      await db
        .update(deliveries)
        .set({
          status: 'failed',
          errorCode: 'decrypt_failed',
          nextAttemptAt: null,
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, deliveryId));
      logDelivery({ connectionId, provider, status: 'failed', sender, room, errorCode: 'decrypt_failed' });
      continue;
    }

    const providerOpts: ProviderOptions = {};
    if (deps.sleep) providerOpts.sleep = deps.sleep;
    if (deps.maxPolls !== undefined) providerOpts.maxPolls = deps.maxPolls;
    const outcome = await deliverToProvider(
      {
        provider: provider as EgressProvider,
        apiBase: row.connection.apiBase,
        token,
        ingress: row.message.ingress as IngressChannel,
        kind,
        sender,
        room: row.message.room,
        body: row.message.body,
        dedupKey: row.message.dedupKey,
      },
      deps.fetch,
      providerOpts,
    );
    const attempts = row.delivery.attempts + 1;

    if (outcome.unauthorized) {
      stopped.add(connectionId);
      await db
        .update(connections)
        .set({ status: 'unauthorized', updatedAt: new Date() })
        .where(eq(connections.id, connectionId));
      await db
        .update(deliveries)
        .set({
          status: 'failed',
          attempts,
          httpStatus: outcome.httpStatus,
          errorCode: outcome.errorCode,
          nextAttemptAt: null,
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, deliveryId));
      logDelivery({
        connectionId,
        provider,
        status: 'failed',
        sender,
        room,
        errorCode: outcome.errorCode ?? 'unauthorized',
      });
      continue;
    }

    if (outcome.ok && outcome.remoteId) {
      await db
        .update(deliveries)
        .set({
          status: 'delivered',
          attempts,
          remoteId: outcome.remoteId,
          httpStatus: outcome.httpStatus,
          errorCode: null,
          nextAttemptAt: null,
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, deliveryId));
      logDelivery({ connectionId, provider, status: 'delivered', sender, room, errorCode: '' });
      continue;
    }

    const decision = shouldRetry({
      httpStatus: outcome.httpStatus,
      ioError: outcome.ioError,
      attemptsAfterFailure: attempts,
    });
    if (decision.retry && decision.delayMs !== null) {
      await db
        .update(deliveries)
        .set({
          status: 'queued',
          attempts,
          httpStatus: outcome.httpStatus,
          errorCode: outcome.errorCode,
          nextAttemptAt: new Date(Date.now() + decision.delayMs),
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, deliveryId));
      logDelivery({
        connectionId,
        provider,
        status: 'queued',
        sender,
        room,
        errorCode: outcome.errorCode ?? 'retry',
      });
      continue;
    }

    await db
      .update(deliveries)
      .set({
        status: 'failed',
        attempts,
        httpStatus: outcome.httpStatus,
        errorCode: outcome.errorCode,
        nextAttemptAt: null,
        updatedAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId));
    logDelivery({
      connectionId,
      provider,
      status: 'failed',
      sender,
      room,
      errorCode: outcome.errorCode ?? 'failed',
    });
  }
}
