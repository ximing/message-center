import { ApiError, readId, readItems, readToken, request } from "./http";
import type { AccessToken } from "./types";

export function listTokens(): Promise<AccessToken[]> {
  return request<unknown>("/api/me/access-tokens").then((data) =>
    readItems<AccessToken>(data),
  );
}

export async function createToken(input: {
  name: string;
}): Promise<AccessToken & { token: string }> {
  const data = await request<unknown>("/api/me/access-tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const token = readToken(data);
  if (!token) throw new ApiError(500, "NO_TOKEN", "服务器没有返回接口令牌");
  const id = readId(data);
  if (!id) throw new ApiError(500, "NO_ID", "服务器没有返回接口令牌标识");
  return { ...(data as AccessToken), id, token };
}

export async function revealToken(id: string): Promise<{ token: string }> {
  const data = await request<unknown>(
    `/api/me/access-tokens/${encodeURIComponent(id)}/reveal`,
    { method: "POST" },
  );
  const token = readToken(data);
  if (!token) throw new ApiError(500, "NO_TOKEN", "服务器没有返回接口令牌");
  return { token };
}

export function renameToken(id: string, name: string): Promise<AccessToken> {
  return request(`/api/me/access-tokens/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function revokeToken(id: string): Promise<void> {
  return request(`/api/me/access-tokens/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
