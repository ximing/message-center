import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { deliverQueued } from "./delivery/deliver.js";
import type { FetchLike } from "./http/outbound.js";
import { setOutboundFetch } from "./http/outbound.js";
import {
  isolatedDbContext,
  setupIsolatedDb,
  teardownIsolatedDb,
} from "./testkit/context.js";
import type { IsolatedDb } from "./testkit/isolated-db.js";

const dbCtx = isolatedDbContext();

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

interface DeliveryView {
  connectionId: string;
  status: string;
  skipReason: string | null;
  remoteId: string | null;
  errorCode: string | null;
}

interface MessageView {
  id: string;
  sender: string;
  room: string | null;
  body?: string;
  kind: string;
  deliveries?: DeliveryView[];
}

const calls: Call[] = [];
let handler: (call: Call) => Response = () => {
  throw new Error("outbound fetch not mocked");
};

function headerRecord(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  const headers = init?.headers;
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const pair of headers) {
      const key = pair[0];
      const value = pair[1];
      if (key !== undefined && value !== undefined) out[key] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) out[key] = String(value);
  }
  return out;
}

const fetchImpl: FetchLike = async (input, init) => {
  const call: Call = {
    url: input,
    method: (init?.method ?? "GET").toUpperCase(),
    headers: headerRecord(init),
    body: typeof init?.body === "string" ? init.body : null,
  };
  calls.push(call);
  return handler(call);
};

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function identity(call: Call): Response | null {
  if (call.method !== "GET") return null;
  if (call.url.endsWith("/api/v1/auth/me")) {
    return jsonRes(200, { id: "vital-user", displayName: "Vital" });
  }
  if (call.url.endsWith("/api/v1/user/info")) {
    return jsonRes(200, {
      code: 0,
      data: { uid: "aimo-user", nickname: "Aimo" },
    });
  }
  if (call.url.endsWith("/api/auth/me")) {
    return jsonRes(200, { id: "inwit-user", displayName: "Inwit" });
  }
  return null;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function errorCode(res: { json: () => unknown }): string {
  const body = res.json() as { error?: { code?: string } };
  return body.error?.code ?? "";
}

describe.skipIf(!dbCtx.available)("http api", () => {
  let iso: IsolatedDb | undefined;
  let app: FastifyInstance | undefined;
  let n = 0;

  beforeAll(async () => {
    iso = await setupIsolatedDb();
    app = await buildApp({ db: iso.db });
  });

  afterAll(async () => {
    setOutboundFetch(async () => {
      throw new Error("outbound network is blocked in tests");
    });
    await app?.close();
    if (iso) await teardownIsolatedDb(iso);
  });

  beforeEach(() => {
    calls.length = 0;
    handler = (call) => {
      const known = identity(call);
      if (known) return known;
      throw new Error(`unexpected ${call.method} ${call.url}`);
    };
    setOutboundFetch(fetchImpl);
  });

  function server(): FastifyInstance {
    if (!app) throw new Error("app is not ready");
    return app;
  }

  function bearer(token: string): { authorization: string } {
    return { authorization: `Bearer ${token}` };
  }

  async function registerUser(): Promise<{
    id: string;
    email: string;
    access: string;
  }> {
    n += 1;
    const email = `user-${n}-${Date.now()}@example.com`;
    const res = await server().inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "password-123" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      user: { id: string };
      tokens?: { accessToken: string };
    };
    const access = body.tokens?.accessToken;
    expect(access).toBeTruthy();
    if (!access) throw new Error("missing access token");
    return { id: body.user.id, email, access };
  }

  async function createKey(
    access: string,
    note: string,
  ): Promise<{ id: string; token: string; note: string }> {
    const res = await server().inject({
      method: "POST",
      url: "/api/me/api-keys",
      headers: bearer(access),
      payload: { name: "phone", note },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; token: string; note: string };
  }

  async function createConnection(
    access: string,
    provider: "vital" | "inwit",
    extra: Record<string, unknown> = {},
  ): Promise<{ id: string; allowImage: boolean; status: string }> {
    const token = provider === "vital" ? "vt_testtoken" : "iwt_testtoken";
    const apiBase =
      provider === "vital" ? "https://vital.test" : "https://inwit.test";
    const res = await server().inject({
      method: "POST",
      url: "/api/me/connections",
      headers: bearer(access),
      payload: { provider, label: provider, apiBase, token, ...extra },
    });
    expect(res.statusCode, res.body).toBe(201);
    const body = res.json() as {
      id: string;
      token?: string;
      allowImage: boolean;
      status: string;
    };
    expect(body).not.toHaveProperty("token");
    return body;
  }

  async function createRule(
    access: string,
    connectionId: string,
    extra: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    n += 1;
    const res = await server().inject({
      method: "POST",
      url: "/api/me/rules",
      headers: bearer(access),
      payload: { name: `rule-${n}`, connectionId, ...extra },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json() as { id: string };
  }

  function wechat(over: Record<string, unknown> = {}): Record<string, unknown> {
    n += 1;
    return {
      moduleBuild: "test",
      type: 1,
      isSend: 0,
      talker: "wxid_friend",
      fromUser: "wxid_friend",
      content: "hello",
      msgSvrId: n,
      createTime: 1_700_000_000,
      ...over,
    };
  }

  async function postWechat(token: string, over: Record<string, unknown> = {}) {
    return server().inject({
      method: "POST",
      url: "/api/v1/ingest/wechat",
      headers: bearer(token),
      payload: wechat(over),
    });
  }

  async function messageDetail(
    access: string,
    id: string,
  ): Promise<MessageView & { body: string; deliveries: DeliveryView[] }> {
    const res = await server().inject({
      method: "GET",
      url: `/api/me/messages/${id}`,
      headers: bearer(access),
    });
    expect(res.statusCode).toBe(200);
    return res.json() as MessageView & {
      body: string;
      deliveries: DeliveryView[];
    };
  }

  it("logout invalidates the old access JWT", async () => {
    const user = await registerUser();
    const me = await server().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearer(user.access),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      id: user.id,
      email: user.email,
      displayName: null,
    });

    const out = await server().inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: bearer(user.access),
    });
    expect(out.statusCode).toBe(204);

    const again = await server().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearer(user.access),
    });
    expect(again.statusCode).toBe(401);
    expect(errorCode(again)).toBe("INVALID_TOKEN");

    const login = await server().inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: user.email, password: "password-123" },
    });
    expect(login.statusCode).toBe(200);
    const next = (login.json() as { tokens: { accessToken: string } }).tokens
      .accessToken;
    const me2 = await server().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearer(next),
    });
    expect(me2.statusCode).toBe(200);
  });

  it("edits only owned active key metadata without rotating or exposing the token", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const key = await createKey(owner.access, "before");
    const patch = (access: string, payload: Record<string, unknown>) =>
      server().inject({
        method: "PATCH",
        url: `/api/me/api-keys/${key.id}`,
        headers: bearer(access),
        payload,
      });
    expect((await patch(other.access, { name: "other" })).statusCode).toBe(404);
    expect((await patch(key.token, { name: "ingest key" })).statusCode).toBe(
      401,
    );
    expect((await patch(owner.access, {})).statusCode).toBe(400);
    expect((await patch(owner.access, { name: "  " })).statusCode).toBe(400);
    const updated = await patch(owner.access, {
      name: " renamed ",
      note: " updated ",
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: key.id,
      name: "renamed",
      note: "updated",
    });
    expect(updated.json()).not.toHaveProperty("token");
    expect(updated.json()).not.toHaveProperty("tokenEncrypted");
    const revealed = await server().inject({
      method: "POST",
      url: `/api/me/api-keys/${key.id}/reveal`,
      headers: bearer(owner.access),
    });
    expect(revealed.json()).toEqual({ token: key.token });
    await server().inject({
      method: "DELETE",
      url: `/api/me/api-keys/${key.id}`,
      headers: bearer(owner.access),
    });
    expect(
      (await patch(owner.access, { note: "after revoke" })).statusCode,
    ).toBe(404);
  });

  it("lists owned delivery summaries without bodies and preserves historical rule references", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const key = await createKey(owner.access, "summary");
    const otherKey = await createKey(other.access, "other");
    const first = await createConnection(owner.access, "vital");
    const second = await createConnection(owner.access, "inwit", {
      allowImage: true,
    });
    const rule = await createRule(owner.access, first.id);
    await createRule(owner.access, second.id);
    const created = await postWechat(key.token, {
      content: "private body",
      msgSvrId: 8101,
    });
    await postWechat(key.token, { content: "", type: 3, msgSvrId: 8102 });
    await postWechat(otherKey.token, {
      content: "another account",
      msgSvrId: 8103,
    });
    const result = await server().inject({
      method: "GET",
      url: "/api/me/messages",
      headers: bearer(owner.access),
    });
    expect(result.statusCode).toBe(200);
    const items = result.json() as MessageView[];
    expect(items).toHaveLength(2);
    expect(result.body).not.toContain("private body");
    expect(result.body).not.toContain("another account");
    for (const item of items) {
      expect(item).not.toHaveProperty("body");
      expect(item.deliveries).toHaveLength(2);
      expect(item.deliveries?.map((d) => d.connectionId).sort()).toEqual(
        [first.id, second.id].sort(),
      );
    }
    const image = items.find((m) => m.kind === "image");
    expect(image?.deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "vital",
          status: "skipped",
          skipReason: "media_disabled",
        }),
        expect.objectContaining({
          provider: "inwit",
          status: "skipped",
          skipReason: "media_transport_pending",
        }),
      ]),
    );
    expect(
      (await messageDetail(owner.access, (created.json() as { id: string }).id))
        .body,
    ).toBe("private body");
    const denied = await server().inject({
      method: "GET",
      url: `/api/me/messages/${(created.json() as { id: string }).id}`,
      headers: bearer(other.access),
    });
    expect(denied.statusCode).toBe(404);
    const deletion = await server().inject({
      method: "DELETE",
      url: `/api/me/rules/${rule.id}`,
      headers: bearer(owner.access),
    });
    expect(deletion.statusCode).toBe(409);
    expect(errorCode(deletion)).toBe("RULE_IN_USE");
    const otherMessages = await server().inject({
      method: "GET",
      url: "/api/me/messages",
      headers: bearer(other.access),
    });
    expect((otherMessages.json() as MessageView[])[0]?.deliveries).toEqual([]);
  });

  it("stores note for display and uses one mck_ key for both ingest routes", async () => {
    const user = await registerUser();
    const created = await createKey(user.access, "desk phone");
    expect(created.token.startsWith("mck_")).toBe(true);
    expect(created.note).toBe("desk phone");

    const listed = await server().inject({
      method: "GET",
      url: "/api/me/api-keys",
      headers: bearer(user.access),
    });
    expect(listed.statusCode).toBe(200);
    const keys = listed.json() as Array<Record<string, unknown>>;
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ id: created.id, note: "desk phone" });
    expect(keys[0]).not.toHaveProperty("token");

    const revealed = await server().inject({
      method: "POST",
      url: `/api/me/api-keys/${created.id}/reveal`,
      headers: bearer(user.access),
    });
    expect(revealed.json()).toEqual({ token: created.token });

    const wechatRes = await postWechat(created.token, {
      content: "from key",
      msgSvrId: 501,
    });
    expect(wechatRes.statusCode).toBe(202);
    const hook = await server().inject({
      method: "POST",
      url: "/api/v1/ingest/webhook",
      headers: bearer(created.token),
      payload: {
        eventId: "evt-key",
        kind: "text",
        sender: "hook",
        text: "via webhook",
      },
    });
    expect(hook.statusCode).toBe(202);

    const sessionIngest = await postWechat(user.access, {
      content: "nope",
      msgSvrId: 502,
    });
    expect(sessionIngest.statusCode).toBe(401);
    expect(errorCode(sessionIngest)).toBe("INVALID_APP_KEY");

    const rules = await server().inject({
      method: "GET",
      url: "/api/me/rules",
      headers: bearer(created.token),
    });
    expect(rules.statusCode).toBe(401);

    const removed = await server().inject({
      method: "DELETE",
      url: `/api/me/api-keys/${created.id}`,
      headers: { ...bearer(user.access), "content-type": "application/json" },
      payload: "",
    });
    expect(removed.statusCode).toBe(204);

    const wechatDenied = await postWechat(created.token, {
      content: "again",
      msgSvrId: 503,
    });
    const hookDenied = await server().inject({
      method: "POST",
      url: "/api/v1/ingest/webhook",
      headers: bearer(created.token),
      payload: {
        eventId: "evt-key-2",
        kind: "text",
        sender: "hook",
        text: "nope",
      },
    });
    expect(wechatDenied.statusCode).toBe(401);
    expect(errorCode(wechatDenied)).toBe("INVALID_APP_KEY");
    expect(hookDenied.statusCode).toBe(401);
    expect(errorCode(hookDenied)).toBe("INVALID_APP_KEY");
  });

  it("并发创建时未吊销密钥不超过 20 把", async () => {
    const user = await registerUser();
    for (let i = 0; i < 19; i += 1) {
      await createKey(user.access, `k${i}`);
    }
    const [first, second] = await Promise.all([
      server().inject({
        method: "POST",
        url: "/api/me/api-keys",
        headers: bearer(user.access),
        payload: { name: "phone", note: "race-a" },
      }),
      server().inject({
        method: "POST",
        url: "/api/me/api-keys",
        headers: bearer(user.access),
        payload: { name: "phone", note: "race-b" },
      }),
    ]);
    const statuses = [first.statusCode, second.statusCode].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const limited = first.statusCode === 409 ? first : second;
    expect(errorCode(limited)).toBe("API_KEY_LIMIT");

    const listed = await server().inject({
      method: "GET",
      url: "/api/me/api-keys",
      headers: bearer(user.access),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(20);
  });

  it("replays a wechat dedup key without adding a delivery", async () => {
    const user = await registerUser();
    const key = await createKey(user.access, "n1");
    const vital = await createConnection(user.access, "vital");
    await createRule(user.access, vital.id);
    const payload = {
      talker: "wxid_friend",
      fromUser: "wxid_friend",
      content: "same",
      msgSvrId: 77,
      type: 1,
    };
    const first = await postWechat(key.token, payload);
    expect(first.statusCode).toBe(202);
    const id = (first.json() as { id: string }).id;
    expect((await messageDetail(user.access, id)).deliveries).toHaveLength(1);

    const second = await postWechat(key.token, payload);
    expect(second.statusCode).toBe(200);
    expect((second.json() as { id: string }).id).toBe(id);
    expect((await messageDetail(user.access, id)).deliveries).toHaveLength(1);
  });

  it("replays a webhook eventId for a second key of the same user", async () => {
    const user = await registerUser();
    const firstKey = await createKey(user.access, "a");
    const secondKey = await createKey(user.access, "b");
    const payload = {
      eventId: "same-event",
      kind: "text",
      sender: "s",
      text: "hello",
    };
    const first = await server().inject({
      method: "POST",
      url: "/api/v1/ingest/webhook",
      headers: bearer(firstKey.token),
      payload,
    });
    expect(first.statusCode).toBe(202);
    const second = await server().inject({
      method: "POST",
      url: "/api/v1/ingest/webhook",
      headers: bearer(secondKey.token),
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect((second.json() as { id: string }).id).toBe(
      (first.json() as { id: string }).id,
    );

    const list = await server().inject({
      method: "GET",
      url: "/api/me/messages",
      headers: bearer(user.access),
    });
    const messages = list.json() as MessageView[];
    expect(messages).toHaveLength(1);
    expect(messages[0]).not.toHaveProperty("body");
  });

  it("parses a group sender prefix and leaves a direct message unsplit", async () => {
    const user = await registerUser();
    const key = await createKey(user.access, "g");
    const room = "999@chatroom";
    const grouped = await postWechat(key.token, {
      talker: room,
      fromUser: "wxid_ignored",
      content: "wxid_abc:\nhello",
      msgSvrId: 11,
    });
    expect(grouped.statusCode).toBe(202);
    const groupMsg = await messageDetail(
      user.access,
      (grouped.json() as { id: string }).id,
    );
    expect(groupMsg).toMatchObject({ sender: "wxid_abc", room, body: "hello" });

    const colon = await postWechat(key.token, {
      talker: room,
      fromUser: "",
      content: "wxid_sender:你好",
      msgSvrId: 12,
    });
    expect(
      await messageDetail(user.access, (colon.json() as { id: string }).id),
    ).toMatchObject({
      sender: "wxid_sender",
      room,
      body: "你好",
    });

    const raw = await postWechat(key.token, {
      talker: room,
      fromUser: "",
      content: "hello:world",
      msgSvrId: 13,
    });
    expect(
      await messageDetail(user.access, (raw.json() as { id: string }).id),
    ).toMatchObject({
      sender: "",
      room,
      body: "hello:world",
    });

    const dm = await postWechat(key.token, {
      talker: "wxid_me",
      fromUser: "wxid_friend",
      content: "ping",
      msgSvrId: 14,
    });
    expect(
      await messageDetail(user.access, (dm.json() as { id: string }).id),
    ).toMatchObject({
      sender: "wxid_friend",
      room: null,
      body: "ping",
    });
  });

  it("creates one delivery per connection and lets exclusive drop the rest", async () => {
    const user = await registerUser();
    const key = await createKey(user.access, "rules");
    const vital = await createConnection(user.access, "vital");
    const inwit = await createConnection(user.access, "inwit");
    await createRule(user.access, vital.id, { name: "vital" });
    await createRule(user.access, inwit.id, { name: "inwit" });

    const both = await postWechat(key.token, {
      content: "two ways",
      msgSvrId: 21,
    });
    const bothMsg = await messageDetail(
      user.access,
      (both.json() as { id: string }).id,
    );
    expect(bothMsg.deliveries.map((row) => row.connectionId).sort()).toEqual(
      [vital.id, inwit.id].sort(),
    );

    await createRule(user.access, vital.id, { name: "vital-again" });
    const once = await postWechat(key.token, {
      content: "one way",
      msgSvrId: 22,
    });
    const onceMsg = await messageDetail(
      user.access,
      (once.json() as { id: string }).id,
    );
    expect(
      onceMsg.deliveries.filter((row) => row.connectionId === vital.id),
    ).toHaveLength(1);
    expect(onceMsg.deliveries).toHaveLength(2);

    const room = "room@chatroom";
    const user2 = await registerUser();
    const key2 = await createKey(user2.access, "ex");
    const exVital = await createConnection(user2.access, "vital");
    const openInwit = await createConnection(user2.access, "inwit");
    await createRule(user2.access, exVital.id, {
      exclusive: true,
      matchRoom: room,
    });
    await createRule(user2.access, openInwit.id, {
      exclusive: false,
      matchSender: "wxid_abc",
    });
    const exclusive = await postWechat(key2.token, {
      talker: room,
      fromUser: "",
      content: "wxid_abc:\nhello",
      msgSvrId: 23,
    });
    const exclusiveMsg = await messageDetail(
      user2.access,
      (exclusive.json() as { id: string }).id,
    );
    expect(exclusiveMsg.deliveries).toEqual([
      expect.objectContaining({ connectionId: exVital.id, status: "queued" }),
    ]);

    const user3 = await registerUser();
    const key3 = await createKey(user3.access, "ex2");
    const a = await createConnection(user3.access, "vital");
    const b = await createConnection(user3.access, "inwit");
    await createRule(user3.access, a.id, {
      exclusive: true,
      matchSender: "wxid_friend",
    });
    await createRule(user3.access, b.id, {
      exclusive: true,
      matchSender: "wxid_friend",
    });
    const bothEx = await postWechat(key3.token, {
      content: "both exclusive",
      msgSvrId: 24,
    });
    const bothExMsg = await messageDetail(
      user3.access,
      (bothEx.json() as { id: string }).id,
    );
    expect(bothExMsg.deliveries.map((row) => row.connectionId).sort()).toEqual(
      [a.id, b.id].sort(),
    );
  });

  it("skips image delivery without calling fetch", async () => {
    const user = await registerUser();
    const key = await createKey(user.access, "img");
    const vital = await createConnection(user.access, "vital");
    expect(vital.allowImage).toBe(false);
    await createRule(user.access, vital.id);
    const blocked = await postWechat(key.token, {
      type: 3,
      content: "",
      msgSvrId: 31,
    });
    expect(blocked.statusCode).toBe(202);
    const blockedMsg = await messageDetail(
      user.access,
      (blocked.json() as { id: string }).id,
    );
    expect(blockedMsg.deliveries).toEqual([
      expect.objectContaining({
        status: "skipped",
        skipReason: "media_disabled",
      }),
    ]);

    calls.length = 0;
    await deliverQueued({
      fetch: fetchImpl,
      userId: user.id,
      sleep: async () => {},
    });
    expect(calls).toHaveLength(0);
    expect(
      (await messageDetail(user.access, blockedMsg.id)).deliveries[0]
        ?.skipReason,
    ).toBe("media_disabled");

    const patched = await server().inject({
      method: "PATCH",
      url: `/api/me/connections/${vital.id}`,
      headers: bearer(user.access),
      payload: { allowImage: true },
    });
    expect(patched.statusCode).toBe(200);
    const pending = await postWechat(key.token, {
      type: 3,
      content: "",
      msgSvrId: 32,
    });
    const pendingMsg = await messageDetail(
      user.access,
      (pending.json() as { id: string }).id,
    );
    expect(pendingMsg.deliveries).toEqual([
      expect.objectContaining({
        status: "skipped",
        skipReason: "media_transport_pending",
      }),
    ]);

    calls.length = 0;
    await deliverQueued({
      fetch: fetchImpl,
      userId: user.id,
      sleep: async () => {},
    });
    expect(calls).toHaveLength(0);
  });

  it("sends a Vital idempotency key for text and omits it for a link with originalUrl", async () => {
    const user = await registerUser();
    const key = await createKey(user.access, "vital");
    const vital = await createConnection(user.access, "vital");
    await createRule(user.access, vital.id);

    const talker = "wxid_friend";
    const type = 1;
    const msgSvrId = 41;
    handler = (call) => {
      const known = identity(call);
      if (known) return known;
      if (
        call.method === "POST" &&
        call.url === "https://vital.test/api/v1/inbox"
      ) {
        return jsonRes(201, { id: "inbox-text" });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    };
    const text = await postWechat(key.token, {
      talker,
      fromUser: talker,
      type,
      msgSvrId,
      content: "first line\nrest",
    });
    expect(text.statusCode).toBe(202);
    calls.length = 0;
    await deliverQueued({
      fetch: fetchImpl,
      userId: user.id,
      sleep: async () => {},
    });
    const textPost = calls.find(
      (call) => call.method === "POST" && call.url.endsWith("/api/v1/inbox"),
    );
    expect(textPost).toBeTruthy();
    const preimage = `wechat/v1\n${talker}\n${type}\n${msgSvrId}`;
    expect(textPost?.headers["Idempotency-Key"]).toBe(sha256(preimage));
    const textBody = JSON.parse(textPost?.body ?? "{}") as {
      source?: string;
      siteName?: string;
      title?: string;
      originalUrl?: string;
    };
    expect(textBody.source).toBe("wechat");
    expect(textBody.siteName).toBe("微信");
    expect(textBody.title).toBe("first line");
    expect(textBody.originalUrl).toBeUndefined();

    const url = "https://example.com/a";
    handler = (call) => {
      const known = identity(call);
      if (known) return known;
      if (
        call.method === "POST" &&
        call.url.endsWith("/api/v1/inbox/extract-jobs")
      ) {
        return jsonRes(200, { id: "job-1", status: "queued" });
      }
      if (
        call.method === "GET" &&
        call.url.endsWith("/api/v1/inbox/extract-jobs/job-1")
      ) {
        return jsonRes(200, {
          id: "job-1",
          status: "succeeded",
          preview: {
            title: "Preview",
            extractedText: "Body",
            markdown: "md",
            siteName: "Example",
          },
        });
      }
      if (call.method === "POST" && call.url.endsWith("/api/v1/inbox")) {
        return jsonRes(201, { id: "inbox-link" });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    };
    const link = await postWechat(key.token, {
      type: 49,
      msgSvrId: 42,
      content: `<msg><appmsg><title>Hi</title><url>${url}</url></appmsg></msg>`,
    });
    expect(link.statusCode).toBe(202);
    calls.length = 0;
    await deliverQueued({
      fetch: fetchImpl,
      userId: user.id,
      sleep: async () => {},
    });
    const inbox = calls.find(
      (call) =>
        call.method === "POST" &&
        call.url === "https://vital.test/api/v1/inbox",
    );
    expect(inbox?.headers["Idempotency-Key"]).toBeUndefined();
    const linkBody = JSON.parse(inbox?.body ?? "{}") as {
      originalUrl?: string;
      title?: string;
      extractedText?: string;
    };
    expect(linkBody.originalUrl).toBe(url);
    expect(linkBody.title).toBe("Preview");
    expect(linkBody.extractedText).toBe("Body");
    expect(calls.some((call) => call.url.endsWith("/extract-jobs/job-1"))).toBe(
      true,
    );

    handler = (call) => {
      const known = identity(call);
      if (known) return known;
      if (
        call.method === "POST" &&
        call.url.endsWith("/api/v1/inbox/extract-jobs")
      ) {
        return jsonRes(200, { id: "job-f", status: "failed" });
      }
      if (call.method === "POST" && call.url.endsWith("/api/v1/inbox")) {
        return jsonRes(201, { id: "inbox-fallback" });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    };
    const failedUrl = "https://example.com/fail";
    const failed = await postWechat(key.token, {
      type: 49,
      msgSvrId: 43,
      content: `<msg><title>Broken</title><url>${failedUrl}</url></msg>`,
    });
    expect(failed.statusCode).toBe(202);
    calls.length = 0;
    await deliverQueued({
      fetch: fetchImpl,
      userId: user.id,
      sleep: async () => {},
    });
    const fallback = calls.find(
      (call) =>
        call.method === "POST" &&
        call.url === "https://vital.test/api/v1/inbox",
    );
    expect(fallback?.headers["Idempotency-Key"]).toBeUndefined();
    const fallbackBody = JSON.parse(fallback?.body ?? "{}") as {
      originalUrl?: string;
      markdown?: string;
    };
    expect(fallbackBody.originalUrl).toBe(failedUrl);
    expect(fallbackBody.markdown).toContain(failedUrl);
  });

  it("marks only the connection that returned 401 as unauthorized", async () => {
    const user = await registerUser();
    const key = await createKey(user.access, "authz");
    const vital = await createConnection(user.access, "vital");
    const inwit = await createConnection(user.access, "inwit");
    await createRule(user.access, vital.id, { name: "v" });
    await createRule(user.access, inwit.id, { name: "i" });
    handler = (call) => {
      const known = identity(call);
      if (known) return known;
      if (
        call.method === "POST" &&
        call.url === "https://vital.test/api/v1/inbox"
      ) {
        return jsonRes(401, { error: { code: "UNAUTHORIZED" } });
      }
      if (
        call.method === "POST" &&
        call.url === "https://inwit.test/api/open/documents"
      ) {
        return jsonRes(201, { id: "doc-1" });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    };
    const first = await postWechat(key.token, { content: "one", msgSvrId: 61 });
    const second = await postWechat(key.token, {
      content: "two",
      msgSvrId: 62,
    });
    calls.length = 0;
    await deliverQueued({
      fetch: fetchImpl,
      userId: user.id,
      sleep: async () => {},
    });

    expect(
      calls.filter(
        (call) => call.method === "POST" && call.url.endsWith("/api/v1/inbox"),
      ),
    ).toHaveLength(1);
    expect(
      calls.filter((call) => call.url.endsWith("/api/open/documents")),
    ).toHaveLength(2);

    const listed = await server().inject({
      method: "GET",
      url: "/api/me/connections",
      headers: bearer(user.access),
    });
    const connections = listed.json() as Array<{ id: string; status: string }>;
    expect(connections.find((row) => row.id === vital.id)?.status).toBe(
      "unauthorized",
    );
    expect(connections.find((row) => row.id === inwit.id)?.status).toBe(
      "active",
    );

    const firstMsg = await messageDetail(
      user.access,
      (first.json() as { id: string }).id,
    );
    const secondMsg = await messageDetail(
      user.access,
      (second.json() as { id: string }).id,
    );
    for (const msg of [firstMsg, secondMsg]) {
      expect(
        msg.deliveries.find((row) => row.connectionId === vital.id)?.status,
      ).toBe("failed");
      expect(
        msg.deliveries.find((row) => row.connectionId === inwit.id),
      ).toMatchObject({
        status: "delivered",
        remoteId: "doc-1",
      });
    }
  });

  it("sends the webhook preimage hash and source manual", async () => {
    const user = await registerUser();
    const key = await createKey(user.access, "hook-vital");
    await createRule(
      user.access,
      (await createConnection(user.access, "vital")).id,
    );
    const eventId = "evt-idem-1";
    handler = (call) => {
      const known = identity(call);
      if (known) return known;
      if (call.method === "POST" && call.url.endsWith("/api/v1/inbox"))
        return jsonRes(201, { id: "inbox-hook" });
      throw new Error(`unexpected ${call.method} ${call.url}`);
    };
    const created = await server().inject({
      method: "POST",
      url: "/api/v1/ingest/webhook",
      headers: bearer(key.token),
      payload: {
        eventId,
        kind: "text",
        sender: "ada",
        room: "general",
        text: "hook line",
      },
    });
    expect(created.statusCode).toBe(202);
    calls.length = 0;
    await deliverQueued({
      fetch: fetchImpl,
      userId: user.id,
      sleep: async () => {},
    });
    const post = calls.find((call) => call.method === "POST");
    expect(post?.headers["Idempotency-Key"]).toBe(
      sha256(`webhook/v1\n${eventId}`),
    );
    const body = JSON.parse(post?.body ?? "{}") as {
      source?: string;
      siteName?: string;
      byline?: string;
    };
    expect(body.source).toBe("manual");
    expect(body.siteName).toBe("Webhook");
    expect(body.byline).toBe("ada · general");
  });

  it("lets an interface token manage the account and keeps it off ingest", async () => {
    const user = await registerUser();
    const other = await registerUser();
    const created = await server().inject({
      method: "POST",
      url: "/api/me/access-tokens",
      headers: bearer(user.access),
      payload: { name: "agent" },
    });
    expect(created.statusCode).toBe(201);
    const token = (created.json() as { token: string; id: string }).token;
    const id = (created.json() as { id: string }).id;
    expect(token.startsWith("mct_")).toBe(true);

    const listed = await server().inject({
      method: "GET",
      url: "/api/me/access-tokens",
      headers: bearer(token),
    });
    expect(listed.statusCode).toBe(200);
    const rows = listed.json() as Array<{ id: string; preview: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(id);
    expect(rows[0]).not.toHaveProperty("token");
    expect(rows[0]?.preview.startsWith("mct_")).toBe(true);

    const me = await server().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearer(token),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ id: user.id, email: user.email });

    const rules = await server().inject({
      method: "GET",
      url: "/api/me/rules",
      headers: bearer(token),
    });
    expect(rules.statusCode).toBe(200);

    const ingest = await postWechat(token, { content: "via pat", msgSvrId: 8801 });
    expect(ingest.statusCode).toBe(401);
    expect(errorCode(ingest)).toBe("INVALID_APP_KEY");

    const key = await createKey(user.access, "ingest-only");
    const managed = await server().inject({
      method: "GET",
      url: "/api/me/rules",
      headers: bearer(key.token),
    });
    expect(managed.statusCode).toBe(401);
    expect(errorCode(managed)).toBe("INVALID_TOKEN");

    const revealed = await server().inject({
      method: "POST",
      url: `/api/me/access-tokens/${id}/reveal`,
      headers: bearer(user.access),
    });
    expect(revealed.json()).toEqual({ token });

    const foreign = await server().inject({
      method: "POST",
      url: `/api/me/access-tokens/${id}/reveal`,
      headers: bearer(other.access),
    });
    expect(foreign.statusCode).toBe(404);
    expect(errorCode(foreign)).toBe("ACCESS_TOKEN_NOT_FOUND");

    const out = await server().inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: bearer(user.access),
    });
    expect(out.statusCode).toBe(204);
    const still = await server().inject({
      method: "GET",
      url: "/api/me/messages",
      headers: bearer(token),
    });
    expect(still.statusCode).toBe(200);

    const renamed = await server().inject({
      method: "PATCH",
      url: `/api/me/access-tokens/${id}`,
      headers: bearer(token),
      payload: { name: "agent-2" },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ id, name: "agent-2" });
    expect(renamed.json()).not.toHaveProperty("token");

    const removed = await server().inject({
      method: "DELETE",
      url: `/api/me/access-tokens/${id}`,
      headers: bearer(token),
    });
    expect(removed.statusCode).toBe(204);
    const denied = await server().inject({
      method: "GET",
      url: "/api/auth/me",
      headers: bearer(token),
    });
    expect(denied.statusCode).toBe(401);
    expect(errorCode(denied)).toBe("INVALID_TOKEN");
  });
});

if (!dbCtx.available) {
  describe("http api (skipped)", () => {
    it("skips because the isolated test database is unavailable", () => {
      console.error(`[testkit] DB tests skipped: ${dbCtx.reason ?? "unknown"}`);
      expect(dbCtx.available).toBe(false);
    });
  });
}
