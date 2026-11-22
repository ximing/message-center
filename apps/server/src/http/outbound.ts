export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

let current: FetchLike = (input, init) => globalThis.fetch(input, init);

export function setOutboundFetch(next: FetchLike | null): void {
  current = next ?? ((input, init) => globalThis.fetch(input, init));
}

export function outboundFetch(input: string, init?: RequestInit): Promise<Response> {
  return current(input, init);
}

export interface HttpJson {
  status: number;
  json: unknown;
}

export async function requestJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<HttpJson | { io: true }> {
  try {
    const res = await fetchImpl(url, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400) {
      return { status: res.status, json: null };
    }
    const text = await res.text();
    if (text.length > 2_000_000) return { status: res.status, json: null };
    if (!text) return { status: res.status, json: null };
    try {
      return { status: res.status, json: JSON.parse(text) as unknown };
    } catch {
      return { status: res.status, json: null };
    }
  } catch {
    return { io: true };
  }
}

export function upstreamErrorCode(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const error = (json as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return fallback;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string' || code.length === 0 || code.length > 64) return fallback;
  if (!/^[A-Za-z0-9_.-]+$/.test(code)) return fallback;
  return code;
}

export function authHeaders(token: string, idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return headers;
}

export function jsonHeaders(token: string, idempotencyKey?: string): Record<string, string> {
  return {
    ...authHeaders(token, idempotencyKey),
    'Content-Type': 'application/json',
  };
}
