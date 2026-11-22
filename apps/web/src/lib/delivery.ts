import type { Delivery, MessageItem } from "@/api/types";

export function deliveryState(d: Delivery): {
  label: string;
  tone: string;
  state: string;
} {
  if (d.status === "skipped" && d.skipReason === "media_transport_pending")
    return { label: "等待转存", tone: "amber", state: "pending" };
  if (d.status === "delivered")
    return { label: "已送达", tone: "green", state: "delivered" };
  if (d.status === "failed")
    return { label: "投递失败", tone: "red", state: "failed" };
  if (d.status === "queued")
    return {
      label: (d.attempts ?? 0) > 0 ? "等待重试" : "排队中",
      tone: "amber",
      state: "queued",
    };
  if (d.status === "skipped")
    return { label: "已跳过", tone: "", state: "skipped" };
  return { label: "状态未知", tone: "", state: "" };
}
export function needsAttention(message: MessageItem): boolean {
  return (message.deliveries ?? []).some(
    (d) =>
      d.status === "failed" || (d.status === "queued" && (d.attempts ?? 0) > 0),
  );
}
