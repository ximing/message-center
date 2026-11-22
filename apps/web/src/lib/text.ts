import { DEFAULT_API_BASE, PROVIDERS, type Provider } from "@/api/types";

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function providerText(value: string | null | undefined): string {
  if (value === "vital") return "Vital";
  if (value === "inwit") return "inwit";
  if (value === "aimo") return "aimo";
  if (!value) return "—";
  return value;
}

export function ingressText(
  value: string | null | undefined,
  whenEmpty = "—",
): string {
  if (value === "wechat") return "微信";
  if (value === "webhook") return "Webhook";
  if (!value) return whenEmpty;
  return value;
}

export function kindText(value: string | null | undefined): string {
  if (value === "text") return "文本";
  if (value === "link") return "链接";
  if (value === "image") return "图片";
  if (value === "voice") return "语音";
  if (!value) return "—";
  return value;
}

export function statusText(value: string | null | undefined): string {
  if (value === "active") return "正常";
  if (value === "unauthorized") return "失效";
  if (value === "queued") return "排队";
  if (value === "delivered") return "已送达";
  if (value === "skipped") return "已跳过";
  if (value === "failed") return "失败";
  if (!value) return "—";
  return value;
}

export function skipText(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "media_disabled") return "media_disabled · 未接收媒体";
  if (value === "media_transport_pending")
    return "media_transport_pending · 等待转存";
  return value;
}

export function textOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function httpText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function matchesAll(
  room: string | null | undefined,
  sender: string | null | undefined,
): boolean {
  return !room?.trim() && !sender?.trim();
}

export function defaultApiBase(provider: string): string {
  if (isProvider(provider)) return DEFAULT_API_BASE[provider];
  return "";
}

export function safeFrom(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("from" in state))
    return null;
  const from = (state as { from?: unknown }).from;
  if (typeof from !== "string") return null;
  if (!from.startsWith("/") || from.startsWith("//") || from === "/login")
    return null;
  return from;
}
