import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMessage, listMessages } from "@/api/messages";
import type { MessageItem } from "@/api/types";
import { MessagesPageService } from "./messages.service";

vi.mock("@/api/messages", () => ({
  getMessage: vi.fn(),
  listMessages: vi.fn(),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const item = (id: string): MessageItem => ({
  id,
  sender: id,
  kind: "text",
  ingress: "wechat",
  deliveries: [],
});

describe("message selection", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not let an older detail response replace the latest selected message", async () => {
    const first = deferred<MessageItem>(),
      second = deferred<MessageItem>();
    vi.mocked(getMessage).mockImplementation((id) =>
      id === "a" ? first.promise : second.promise,
    );
    const s = new MessagesPageService();
    s.items = [item("a"), item("b")];
    const a = s.select("a");
    const b = s.select("b");
    second.resolve({ ...item("b"), body: "body b" });
    await b;
    first.resolve({ ...item("a"), body: "body a" });
    await a;
    expect(s.openId).toBe("b");
    expect(s.body).toBe("body b");
    expect(s.detailLoading).toBe(false);
  });
  it("discards pending body responses when filters leave no visible message", async () => {
    const pending = deferred<MessageItem>();
    vi.mocked(getMessage).mockReturnValue(pending.promise);
    const s = new MessagesPageService();
    s.items = [item("a")];
    const load = s.select("a");
    s.setSearch("missing");
    pending.resolve({ ...item("a"), body: "private body" });
    await load;
    expect(s.openId).toBeNull();
    expect(s.body).toBeNull();
    expect(s.detailLoading).toBe(false);
  });
  it("resets pagination when filters change and never searches body content", () => {
    const s = new MessagesPageService();
    s.items = Array.from({ length: 25 }, (_, i) => ({
      ...item(String(i)),
      body: "not searchable",
    }));
    s.page = 3;
    s.setSearch("not searchable");
    expect(s.page).toBe(1);
    expect(s.filtered).toEqual([]);
    expect(s.totalPages).toBe(1);
  });
  it("reloads the open message when a quiet refresh sees a new delivery status", async () => {
    vi.mocked(listMessages).mockResolvedValue([
      { ...item("a"), deliveries: [{ id: "d", status: "delivered" }] },
    ]);
    vi.mocked(getMessage).mockResolvedValue({
      ...item("a"),
      body: "hello",
      deliveries: [{ id: "d", status: "delivered" }],
    });
    const s = new MessagesPageService();
    s.items = [{ ...item("a"), deliveries: [{ id: "d", status: "queued" }] }];
    s.openId = "a";
    s.body = "hello";
    await expect(s.refreshQuiet()).resolves.toBe(true);
    expect(getMessage).toHaveBeenCalledWith("a");
    expect(s.body).toBe("hello");
    expect(s.items[0]?.deliveries?.[0]?.status).toBe("delivered");
  });
  it("keeps the open body when a quiet refresh sees the same deliveries", async () => {
    const row = { ...item("a"), deliveries: [{ id: "d", status: "queued" }] };
    vi.mocked(listMessages).mockResolvedValue([row]);
    const s = new MessagesPageService();
    s.items = [row];
    s.openId = "a";
    s.body = "hello";
    await expect(s.refreshQuiet()).resolves.toBe(true);
    expect(getMessage).not.toHaveBeenCalled();
    expect(s.body).toBe("hello");
  });
  it("does not start a quiet refresh while a load is in progress", async () => {
    const s = new MessagesPageService();
    s.loading = true;
    await expect(s.refreshQuiet()).resolves.toBe(false);
    expect(listMessages).not.toHaveBeenCalled();
  });
});
