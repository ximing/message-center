import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { deliverQueued } from '../delivery/deliver.js';
import type { FetchLike } from '../http/outbound.js';
import { setOutboundFetch } from '../http/outbound.js';
import { isolatedDbContext, setupIsolatedDb, teardownIsolatedDb } from '../testkit/context.js';
import type { IsolatedDb } from '../testkit/isolated-db.js';

const dbCtx = isolatedDbContext();

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const fetchImpl: FetchLike = async (input, init) => {
  const url = input;
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET' && url.endsWith('/api/v1/auth/me')) {
    return jsonRes(200, { id: 'vital-user', displayName: 'Vital' });
  }
  if (method === 'POST' && url.endsWith('/api/v1/inbox')) {
    return jsonRes(201, { id: 'inbox-1' });
  }
  throw new Error(`unexpected ${method} ${url}`);
};

describe.skipIf(!dbCtx.available)('live feed', () => {
  let iso: IsolatedDb | undefined;
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    iso = await setupIsolatedDb();
    app = await buildApp({ db: iso.db });
    setOutboundFetch(fetchImpl);
  });

  afterAll(async () => {
    setOutboundFetch(async () => {
      throw new Error('outbound network is blocked in tests');
    });
    await app?.close();
    if (iso) await teardownIsolatedDb(iso);
  });

  async function registerUser(): Promise<{ access: string; id: string }> {
    const res = await app!.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `live-${Date.now()}@example.com`, password: 'password-123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { user: { id: string }; tokens?: { accessToken: string } };
    const access = body.tokens?.accessToken;
    if (!access) throw new Error('missing access token');
    return { access, id: body.user.id };
  }

  it('reports a change after a message is accepted and after it is delivered', async () => {
    const user = await registerUser();
    const headers = { authorization: `Bearer ${user.access}` };
    const handshake = await app!.inject({ method: 'GET', url: '/api/me/live', headers });
    expect(handshake.statusCode).toBe(200);
    expect(handshake.json()).toEqual({ revision: '0', changed: false });

    const connection = await app!.inject({
      method: 'POST',
      url: '/api/me/connections',
      headers,
      payload: {
        provider: 'vital',
        label: 'vital',
        apiBase: 'https://vital.test',
        token: 'vt_testtoken',
      },
    });
    expect(connection.statusCode).toBe(201);
    const connectionId = (connection.json() as { id: string }).id;
    const rule = await app!.inject({
      method: 'POST',
      url: '/api/me/rules',
      headers,
      payload: { name: 'vital', connectionId },
    });
    expect(rule.statusCode).toBe(201);

    const key = await app!.inject({
      method: 'POST',
      url: '/api/me/api-keys',
      headers,
      payload: { name: 'phone', note: 'live' },
    });
    expect(key.statusCode).toBe(201);
    const token = (key.json() as { token: string }).token;

    const before = await app!.inject({ method: 'GET', url: '/api/me/live?since=0', headers });
    expect(before.json()).toEqual({ revision: '1', changed: true });

    const ingested = await app!.inject({
      method: 'POST',
      url: '/api/v1/ingest/wechat',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        moduleBuild: 'test',
        type: 1,
        isSend: 0,
        talker: 'wxid_friend',
        fromUser: 'wxid_friend',
        content: 'hello',
        msgSvrId: 9001,
        createTime: 1_700_000_000,
      },
    });
    expect(ingested.statusCode).toBe(202);

    const queued = await app!.inject({ method: 'GET', url: '/api/me/live?since=1', headers });
    expect(queued.json()).toEqual({ revision: '2', changed: true });
    expect((await app!.inject({ method: 'GET', url: '/api/me/live?since=2', headers })).json()).toEqual({
      revision: '2',
      changed: false,
    });

    await deliverQueued({ fetch: fetchImpl, userId: user.id, sleep: async () => undefined });
    const delivered = await app!.inject({ method: 'GET', url: '/api/me/live?since=2', headers });
    expect(delivered.json()).toMatchObject({ changed: true });
    const revision = (delivered.json() as { revision: string }).revision;
    expect(BigInt(revision) > 2n).toBe(true);

    const bad = await app!.inject({ method: 'GET', url: '/api/me/live?since=nope', headers });
    expect(bad.statusCode).toBe(400);
    const anon = await app!.inject({ method: 'GET', url: '/api/me/live' });
    expect(anon.statusCode).toBe(401);
  });
});
