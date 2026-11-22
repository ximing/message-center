import { Writable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import { registerErrorHandler } from './error-handler.js';

function memoryLog(): { stream: Writable; text: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      callback();
    },
  });
  return {
    stream,
    text: () => Buffer.concat(chunks).toString('utf8'),
  };
}

describe('registerErrorHandler', () => {
  const apps: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function build(stream: Writable): FastifyInstance {
    const app = Fastify({
      logger: {
        level: 'error',
        stream,
      },
    });
    registerErrorHandler(app);
    apps.push(app);
    return app;
  }

  it('records the cause of an unhandled error without putting it in the response', async () => {
    const logs = memoryLog();
    const app = build(logs.stream);
    app.get('/boom', () => {
      throw new Error('db down from test');
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    });
    expect(res.body).not.toContain('db down from test');
    const text = logs.text();
    expect(text).toContain('db down from test');
    expect(text).toContain('unhandled error');
  });

  it('does not log a handled AppError as unhandled', async () => {
    const logs = memoryLog();
    const app = build(logs.stream);
    app.get('/missing', () => {
      throw AppError.of(404, 'NOT_FOUND');
    });

    const res = await app.inject({ method: 'GET', url: '/missing' });

    expect(res.statusCode).toBe(404);
    const body: unknown = res.json();
    expect(body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(logs.text()).not.toContain('资源不存在');
    expect(logs.text()).not.toContain('unhandled error');
  });
});
