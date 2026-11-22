import { readItems, request } from "./http";
import type { Connection, ConnectionInput, ConnectionPatch } from "./types";

export function listConnections(): Promise<Connection[]> {
  return request<unknown>("/api/me/connections").then((data) =>
    readItems<Connection>(data),
  );
}

export function createConnection(input: ConnectionInput): Promise<Connection> {
  return request("/api/me/connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchConnection(
  id: string,
  input: ConnectionPatch,
): Promise<Connection> {
  return request(`/api/me/connections/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteConnection(id: string): Promise<void> {
  return request(`/api/me/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
