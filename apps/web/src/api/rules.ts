import { readItems, request } from "./http";
import type { Rule, RuleInput, RulePatch } from "./types";

export function listRules(): Promise<Rule[]> {
  return request<unknown>("/api/me/rules").then((data) =>
    readItems<Rule>(data),
  );
}

export function createRule(input: RuleInput): Promise<Rule> {
  return request("/api/me/rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchRule(id: string, input: RulePatch): Promise<Rule> {
  return request(`/api/me/rules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteRule(id: string): Promise<void> {
  return request(`/api/me/rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
