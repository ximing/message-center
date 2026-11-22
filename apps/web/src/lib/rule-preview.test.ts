import { describe, expect, it } from "vitest";
import type { Rule } from "@/api/types";
import { previewRules } from "./rule-preview";
import { deliveryState, needsAttention } from "./delivery";

const ordinary: Rule = {
  id: "ordinary",
  name: "ordinary",
  connectionId: "vital",
  enabled: true,
  matchSender: "alice",
};
const exclusive: Rule = {
  id: "exclusive",
  name: "exclusive",
  connectionId: "aimo",
  enabled: true,
  exclusive: true,
  matchRoom: "group",
  matchIngress: "wechat",
};
const message = {
  sender: "alice",
  room: "group",
  ingress: "wechat",
  kind: "text",
};
describe("rule preview", () => {
  it("keeps all exclusive matches and deduplicates their destinations", () => {
    const result = previewRules(
      [
        ordinary,
        exclusive,
        { ...exclusive, id: "copy" },
        { ...exclusive, id: "other", connectionId: "inwit" },
      ],
      message,
    );
    expect(result.hits).toHaveLength(4);
    expect(result.eligible.map((r) => r.id)).toEqual([
      "exclusive",
      "copy",
      "other",
    ]);
    expect(result.connectionIds).toEqual(["aimo", "inwit"]);
  });
  it("requires every filled condition and excludes disabled rules", () => {
    expect(
      previewRules([exclusive], { ...message, ingress: "webhook" }).hits,
    ).toEqual([]);
    expect(
      previewRules([{ ...ordinary, matchRoom: "different" }], message).hits,
    ).toEqual([]);
    expect(
      previewRules([{ ...ordinary, enabled: false }], message).hits,
    ).toEqual([]);
  });
  it("fans out ordinary rules and permits an empty sender to match all", () => {
    expect(
      previewRules(
        [
          ordinary,
          { ...ordinary, id: "second", connectionId: "inwit" },
          { ...ordinary, id: "copy" },
        ],
        message,
      ).connectionIds,
    ).toEqual(["vital", "inwit"]);
    expect(
      previewRules([{ ...ordinary, matchSender: null }], {
        ...message,
        sender: "",
      }).connectionIds,
    ).toEqual(["vital"]);
  });
});
describe("delivery presentation", () => {
  it("distinguishes pending media from disabled media without inventing a backend status", () => {
    expect(
      deliveryState({
        id: "1",
        status: "skipped",
        skipReason: "media_transport_pending",
      }).label,
    ).toBe("等待转存");
    expect(
      deliveryState({
        id: "2",
        status: "skipped",
        skipReason: "media_disabled",
      }).label,
    ).toBe("已跳过");
  });
  it("separates a newly queued delivery from a retry and counts mixed results as needing attention", () => {
    expect(
      needsAttention({
        id: "1",
        deliveries: [{ id: "a", status: "queued", attempts: 0 }],
      }),
    ).toBe(false);
    expect(
      needsAttention({
        id: "1",
        deliveries: [
          { id: "a", status: "delivered" },
          { id: "b", status: "failed" },
        ],
      }),
    ).toBe(true);
    expect(
      deliveryState({ id: "a", status: "queued", attempts: 1 }).label,
    ).toBe("等待重试");
  });
});
