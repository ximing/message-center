import { loginInputSchema, refreshInputSchema, registerInputSchema } from '@mc/dto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { headerString } from './bearer.js';
import { authModeFromOrigin } from './auth-logic.js';
import { getMe, loginUser, logoutSession, refreshBearer, registerUser } from './auth.service.js';
import { requireUser } from './authenticate.js';
import { clearAuthCookies } from './cookies.js';
import { oidcEnabled } from './oidc.js';

function modeOf(req: FastifyRequest) {
  const origin = headerString(req.headers.origin);
  return authModeFromOrigin(origin, config.WEB_ORIGIN);
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post('/api/auth/register', async (req, reply) => {
    const input = registerInputSchema.parse(req.body);
    const response = await registerUser(input, reply, modeOf(req));
    return reply.code(201).send(response);
  });

  app.post('/api/auth/login', async (req, reply) => {
    const input = loginInputSchema.parse(req.body);
    return loginUser(input, reply, modeOf(req));
  });

  app.post('/api/auth/refresh', async (req) => {
    const input = refreshInputSchema.parse(req.body);
    return refreshBearer(input.refreshToken);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await logoutSession(req);
    clearAuthCookies(reply);
    return reply.code(204).send();
  });

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (req) => {
    return getMe(requireUser(req).id);
  });

  app.get('/api/auth/oidc/status', async () => {
    return {
      enabled: oidcEnabled({
        OIDC_ISSUER: config.OIDC_ISSUER,
        OIDC_CLIENT_ID: config.OIDC_CLIENT_ID,
        OIDC_CLIENT_SECRET: config.OIDC_CLIENT_SECRET,
        OIDC_REDIRECT_URI: config.OIDC_REDIRECT_URI,
        OIDC_AUDIENCE: config.OIDC_AUDIENCE,
      }),
    };
  });
}
