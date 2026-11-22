import type { IngressChannel } from '@mc/dto';
import type { ConnectionRow, ForwardRuleRow } from '../db/schema.js';

export interface MatchMessage {
  ingress: IngressChannel;
  sender: string;
  room: string | null;
  kind: 'text' | 'link' | 'image' | 'voice';
}

export function ruleMatches(rule: ForwardRuleRow, message: MatchMessage): boolean {
  if (!rule.enabled) return false;
  if (rule.matchIngress && rule.matchIngress !== message.ingress) return false;
  if (rule.matchRoom && rule.matchRoom !== (message.room ?? '')) return false;
  if (rule.matchSender && rule.matchSender !== message.sender) return false;
  return true;
}

/** Exclusive hits drop the rest. One delivery per connection, preferring an exclusive rule. */
export function selectRules(rules: ForwardRuleRow[], message: MatchMessage): ForwardRuleRow[] {
  const hits = rules.filter((rule) => ruleMatches(rule, message));
  const exclusive = hits.some((rule) => rule.exclusive);
  const pool = exclusive ? hits.filter((rule) => rule.exclusive) : hits;
  const byConnection = new Map<string, ForwardRuleRow>();
  for (const rule of pool) {
    const prev = byConnection.get(rule.connectionId);
    if (!prev || (rule.exclusive && !prev.exclusive)) byConnection.set(rule.connectionId, rule);
  }
  return [...byConnection.values()];
}

export function initialDelivery(kind: MatchMessage['kind'], connection: ConnectionRow): {
  status: 'queued' | 'skipped';
  skipReason: 'media_disabled' | 'media_transport_pending' | null;
} {
  if (kind !== 'image' && kind !== 'voice') return { status: 'queued', skipReason: null };
  const allowed = kind === 'image' ? connection.allowImage : connection.allowVoice;
  return allowed
    ? { status: 'skipped', skipReason: 'media_transport_pending' }
    : { status: 'skipped', skipReason: 'media_disabled' };
}
