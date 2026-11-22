import { createApiKeyInputSchema, patchApiKeyInputSchema } from "@mc/dto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth/authenticate.js";
import {
  createApiKey,
  listApiKeys,
  revealApiKey,
  revokeApiKey,
  updateApiKey,
} from "./api-keys.js";

const idParams = z.object({ id: z.string().uuid() });

export function registerApiKeyRoutes(app: FastifyInstance): void {
  const auth = { preHandler: [app.authenticate] };

  app.get("/api/me/api-keys", auth, async (req) => {
    return listApiKeys(requireUser(req).id);
  });

  app.post("/api/me/api-keys", auth, async (req, reply) => {
    const input = createApiKeyInputSchema.parse(req.body);
    const created = await createApiKey(requireUser(req).id, input);
    return reply.code(201).send(created);
  });

  app.post("/api/me/api-keys/:id/reveal", auth, async (req) => {
    const { id } = idParams.parse(req.params);
    return revealApiKey(requireUser(req).id, id);
  });

  app.patch("/api/me/api-keys/:id", auth, async (req) => {
    const { id } = idParams.parse(req.params);
    return updateApiKey(
      requireUser(req).id,
      id,
      patchApiKeyInputSchema.parse(req.body),
    );
  });

  app.delete("/api/me/api-keys/:id", auth, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await revokeApiKey(requireUser(req).id, id);
    return reply.code(204).send();
  });
}
