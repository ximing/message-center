import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/authenticate.js';
import { getMessage, listMessages } from './messages.js';

const idParams = z.object({ id: z.string().uuid() });

export function registerMessageRoutes(app: FastifyInstance): void {
  const auth = { preHandler: [app.authenticate] };

  app.get('/api/me/messages', auth, async (req) => {
    return listMessages(requireUser(req).id);
  });

  app.get('/api/me/messages/:id', auth, async (req) => {
    const { id } = idParams.parse(req.params);
    return getMessage(requireUser(req).id, id);
  });
}
