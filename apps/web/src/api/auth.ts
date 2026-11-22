import { request } from "./http";
import type { User } from "./types";

export function login(input: {
  email: string;
  password: string;
}): Promise<unknown> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function register(input: {
  email: string;
  password: string;
}): Promise<unknown> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return request("/api/auth/logout", { method: "POST" });
}

export function me(): Promise<User> {
  return request<User>("/api/auth/me");
}

export function oidcStatus(): Promise<{ enabled?: boolean }> {
  return request("/api/auth/oidc/status", { redirect: "manual" });
}
