import { createAccessTokenInputSchema, patchAccessTokenInputSchema } from '@mc/dto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from './authenticate.js';
import {
  createAccessToken,
  listAccessTokens,
  revealAccessToken,
  revokeAccessToken,
  updateAccessToken,
} from './access-tokens.js';

const idParams = z.object({ id: z.string().uuid() });

export function registerAccessTokenRoutes(app: FastifyInstance): void {
  const auth = { preHandler: [app.authenticate] };

  app.get('/api/me/access-tokens', auth, async (req) => {
    return listAccessTokens(requireUser(req).id);
  });

  app.post('/api/me/access-tokens', auth, async (req, reply) => {
    const input = createAccessTokenInputSchema.parse(req.body);
    const created = await createAccessToken(requireUser(req).id, input);
    return reply.code(201).send(created);
  });

  app.post('/api/me/access-tokens/:id/reveal', auth, async (req) => {
    const { id } = idParams.parse(req.params);
    return revealAccessToken(requireUser(req).id, id);
  });

  app.patch('/api/me/access-tokens/:id', auth, async (req) => {
    const { id } = idParams.parse(req.params);
    return updateAccessToken(requireUser(req).id, id, patchAccessTokenInputSchema.parse(req.body));
  });

  app.delete('/api/me/access-tokens/:id', auth, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await revokeAccessToken(requireUser(req).id, id);
    return reply.code(204).send();
  });
}
