import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Database } from './db/index.js';

export type AuthPrincipal = { id: string };

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    // 生产环境挂上网页构建目录后，未命中的页面回退到 index.html。未挂载时为空字符串。
    webDistRoot: string;
  }
  interface FastifyRequest {
    user?: AuthPrincipal;
  }
}
