import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { config } from './config.js';

// 生产由 server 托管网页构建产物。入口 nginx 只反代到这一个端口。
// dist 不存在时跳过，本地开发和测试的接口行为不变。
export function resolveWebDistRoot(): string | null {
  if (config.NODE_ENV !== 'production') return null;
  // 源码在 apps/server/src，镜像里在 apps/server/dist，网页都在 ../../web/dist。
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '../../web/dist');
  return existsSync(path.join(dist, 'index.html')) ? dist : null;
}

export async function registerWebStatic(app: FastifyInstance): Promise<void> {
  const dist = resolveWebDistRoot();
  if (!dist) return;

  await app.register(fastifyStatic, {
    root: dist,
    prefix: '/',
    setHeaders: (reply, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        void reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        return;
      }
      if (filePath.endsWith(`${path.sep}index.html`)) {
        void reply.header('Cache-Control', 'no-cache');
      }
    },
  });
  app.webDistRoot = dist;
}
