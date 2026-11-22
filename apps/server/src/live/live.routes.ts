import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/authenticate.js';
import { AppError } from '../errors.js';
import { decideLive, parseLiveSince } from './live-logic.js';
import { readLiveRevision } from './revision.js';

const querySchema = z.object({
  since: z.unknown().optional(),
});

export function registerLiveRoutes(app: FastifyInstance): void {
  app.get('/api/me/live', { preHandler: [app.authenticate] }, async (req) => {
    const { since } = querySchema.parse(req.query);
    let cursor: bigint | null;
    try {
      cursor = parseLiveSince(since);
    } catch {
      throw AppError.of(400, 'VALIDATION_ERROR');
    }
    return decideLive(await readLiveRevision(requireUser(req).id), cursor);
  });
}
