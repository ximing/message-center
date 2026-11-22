import type { Rule } from "@/api/types";

export interface MatchInput {
  ingress: string;
  sender: string;
  room: string;
  kind: string;
}
export function previewRules(rules: Rule[], message: MatchInput) {
  const hits = rules.filter(
    (rule) =>
      rule.enabled !== false &&
      (!rule.matchIngress || rule.matchIngress === message.ingress) &&
      (!rule.matchRoom || rule.matchRoom === message.room) &&
      (!rule.matchSender || rule.matchSender === message.sender),
  );
  const exclusive = hits.some((rule) => rule.exclusive === true);
  const eligible = hits.filter((rule) => !exclusive || rule.exclusive === true);
  const connectionIds = [...new Set(eligible.map((rule) => rule.connectionId))];
  return { hits, eligible, exclusive, connectionIds };
}
