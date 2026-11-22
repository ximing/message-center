import { ApiError, readId, readItems, readToken, request } from "./http";
import type { ApiKey } from "./types";

export function listKeys(): Promise<ApiKey[]> {
  return request<unknown>("/api/me/api-keys").then((data) =>
    readItems<ApiKey>(data),
  );
}

export async function createKey(input: {
  name: string;
  note: string;
}): Promise<ApiKey & { token: string }> {
  const data = await request<unknown>("/api/me/api-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const token = readToken(data);
  if (!token) throw new ApiError(500, "NO_TOKEN", "服务器没有返回密钥");
  const id = readId(data);
  if (!id) throw new ApiError(500, "NO_ID", "服务器没有返回密钥标识");
  return { ...(data as ApiKey), id, token };
}

export async function revealKey(id: string): Promise<{ token: string }> {
  const data = await request<unknown>(
    `/api/me/api-keys/${encodeURIComponent(id)}/reveal`,
    {
      method: "POST",
    },
  );
  const token = readToken(data);
  if (!token) throw new ApiError(500, "NO_TOKEN", "服务器没有返回密钥");
  return { token };
}

export function revokeKey(id: string): Promise<void> {
  return request(`/api/me/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function patchKey(
  id: string,
  input: { name: string; note: string },
): Promise<ApiKey> {
  return request(`/api/me/api-keys/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
