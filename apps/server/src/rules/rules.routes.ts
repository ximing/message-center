import { createRuleInputSchema, patchRuleInputSchema } from '@mc/dto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/authenticate.js';
import { createRule, deleteRule, listRules, updateRule } from './rules.js';

const idParams = z.object({ id: z.string().uuid() });

export function registerRuleRoutes(app: FastifyInstance): void {
  const auth = { preHandler: [app.authenticate] };

  app.get('/api/me/rules', auth, async (req) => {
    return listRules(requireUser(req).id);
  });

  app.post('/api/me/rules', auth, async (req, reply) => {
    const input = createRuleInputSchema.parse(req.body);
    const created = await createRule(requireUser(req).id, input);
    return reply.code(201).send(created);
  });

  app.patch('/api/me/rules/:id', auth, async (req) => {
    const { id } = idParams.parse(req.params);
    const input = patchRuleInputSchema.parse(req.body);
    return updateRule(requireUser(req).id, id, input);
  });

  app.delete('/api/me/rules/:id', auth, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await deleteRule(requireUser(req).id, id);
    return reply.code(204).send();
  });
}
