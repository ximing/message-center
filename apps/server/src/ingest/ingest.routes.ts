import { webhookIngestSchema, wechatIngestSchema } from '@mc/dto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { headerString, readBearerToken } from '../auth/bearer.js';
import { AppError } from '../errors.js';
import { findActiveApiKey } from '../keys/api-keys.js';
import { isAccountKey } from '../keys/api-key-logic.js';
import type { ApiKeyRow } from '../db/schema.js';
import { ingestWebhook, ingestWechat } from './ingest.js';

const ingestLimit = { bodyLimit: 512 * 1024 };

async function requireAccountKey(req: FastifyRequest): Promise<ApiKeyRow> {
  const token = readBearerToken(headerString(req.headers.authorization));
  if (!token || !isAccountKey(token)) throw AppError.of(401, 'INVALID_APP_KEY');
  const key = await findActiveApiKey(token);
  if (!key) throw AppError.of(401, 'INVALID_APP_KEY');
  return key;
}

export function registerIngestRoutes(app: FastifyInstance): void {
  app.post('/api/v1/ingest/wechat', ingestLimit, async (req, reply) => {
    const key = await requireAccountKey(req);
    const input = wechatIngestSchema.parse(req.body);
    const result = await ingestWechat(key, input);
    return reply.code(result.created ? 202 : 200).send(result.message);
  });

  app.post('/api/v1/ingest/webhook', ingestLimit, async (req, reply) => {
    const key = await requireAccountKey(req);
    const input = webhookIngestSchema.parse(req.body);
    const result = await ingestWebhook(key, input);
    return reply.code(result.created ? 202 : 200).send(result.message);
  });
}
