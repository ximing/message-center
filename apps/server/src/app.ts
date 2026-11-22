import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAccessTokenRoutes } from './auth/access-tokens.routes.js';
import { authenticate } from './auth/authenticate.js';
import { registerAuthRoutes } from './auth/auth.routes.js';
import { config } from './config.js';
import { registerConnectionRoutes } from './connections/connections.routes.js';
import { getDb, setDb, type Database } from './db/index.js';
import { registerIngestRoutes } from './ingest/ingest.routes.js';
import { registerLiveRoutes } from './live/live.routes.js';
import { registerApiKeyRoutes } from './keys/api-keys.routes.js';
import { registerMessageRoutes } from './messages/messages.routes.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerRuleRoutes } from './rules/rules.routes.js';
import { registerWebStatic } from './web-static.js';
import './types.js';

export interface BuildAppOptions {
  db?: Database;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  if (opts.db) setDb(opts.db);

  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: config.LOG_LEVEL },
  });
  app.decorate('db', getDb());
  app.decorate('authenticate', authenticate);
  app.decorate('webDistRoot', '');

  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
  });
  await app.register(cookie, { secret: config.COOKIE_SECRET });
  // Clients often send Content-Type: application/json on DELETE/reveal with no body.
  // Fastify's default parser turns that into an error and the key is left active.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (text.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text) as unknown);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('invalid json');
      (error as Error & { statusCode?: number }).statusCode = 400;
      done(error, undefined);
    }
  });
  registerErrorHandler(app);

  app.get('/health', async () => ({ ok: true }));
  registerAuthRoutes(app);
  registerAccessTokenRoutes(app);
  registerApiKeyRoutes(app);
  registerConnectionRoutes(app);
  registerRuleRoutes(app);
  registerMessageRoutes(app);
  registerLiveRoutes(app);
  registerIngestRoutes(app);
  await registerWebStatic(app);

  return app;
}
