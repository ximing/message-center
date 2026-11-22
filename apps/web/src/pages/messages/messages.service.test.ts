import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMessage } from "@/api/messages";
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
});
