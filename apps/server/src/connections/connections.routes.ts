import { createConnectionInputSchema, patchConnectionInputSchema } from '@mc/dto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/authenticate.js';
import { createConnection, deleteConnection, listConnections, updateConnection } from './connections.js';

const idParams = z.object({ id: z.string().uuid() });

export function registerConnectionRoutes(app: FastifyInstance): void {
  const auth = { preHandler: [app.authenticate] };

  app.get('/api/me/connections', auth, async (req) => {
    return listConnections(requireUser(req).id);
  });

  app.post('/api/me/connections', auth, async (req, reply) => {
    const input = createConnectionInputSchema.parse(req.body);
    const created = await createConnection(requireUser(req).id, input);
    return reply.code(201).send(created);
  });

  app.patch('/api/me/connections/:id', auth, async (req) => {
    const { id } = idParams.parse(req.params);
    const input = patchConnectionInputSchema.parse(req.body);
    return updateConnection(requireUser(req).id, id, input);
  });

  app.delete('/api/me/connections/:id', auth, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await deleteConnection(requireUser(req).id, id);
    return reply.code(204).send();
  });
}
