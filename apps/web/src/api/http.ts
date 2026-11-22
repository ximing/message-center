export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ErrorBody = { error: { code: string; message: string } };

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value))
    return false;
  const error = (value as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return false;
  const record = error as { code?: unknown; message?: unknown };
  return typeof record.code === "string" && typeof record.message === "string";
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

const SKIP_UNAUTHORIZED = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/oidc/status",
]);

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError(0, "BAD_PATH", "请求路径不正确");
  }

  const headers = new Headers(init.headers);
  // Session is the mc_at / mc_rt cookies. Never send Authorization.
  if (headers.has("Authorization")) headers.delete("Authorization");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: "include",
      cache: init.cache ?? "no-store",
      redirect: init.redirect ?? "follow",
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    throw new ApiError(
      0,
      "NETWORK",
      raw === "Failed to fetch" || raw.length === 0 ? "网络错误" : raw,
    );
  }

  if (response.type === "opaqueredirect") {
    throw new ApiError(0, "REDIRECT", "统一账号状态不可用");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: unknown;
  if (text.length > 0) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = undefined;
    }
  }

  if (!response.ok) {
    const parsed = isErrorBody(data) ? data.error : undefined;
    const error = new ApiError(
      response.status,
      parsed?.code ?? "UNKNOWN",
      parsed?.message || text || response.statusText || "请求失败",
    );
    if (response.status === 401 && !SKIP_UNAUTHORIZED.has(path)) {
      onUnauthorized?.();
    }
    throw error;
  }

  return data as T;
}

export function apiMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message || "请求失败";
  if (err instanceof Error && err.message) return err.message;
  return "请求失败";
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export function readItems<T extends object>(data: unknown): T[] {
  const list = Array.isArray(data)
    ? data
    : typeof data === "object" &&
        data !== null &&
        "items" in data &&
        Array.isArray((data as { items: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  return list.filter(
    (item): item is T => typeof item === "object" && item !== null,
  );
}

export function readToken(data: unknown): string {
  if (typeof data !== "object" || data === null || !("token" in data))
    return "";
  const token = (data as { token: unknown }).token;
  return typeof token === "string" ? token : "";
}

export function readId(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("id" in data)) return null;
  const id = (data as { id: unknown }).id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number") return String(id);
  return null;
}
