import { createHash } from 'node:crypto';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Preimage whose sha256 is both dedup_key and the Vital Idempotency-Key. */
export function wechatDedupPreimage(input: {
  talker: string;
  type: number;
  msgSvrId: number;
  createTime: number;
  content: string;
}): string {
  if (input.msgSvrId > 0) {
    return `wechat/v1\n${input.talker}\n${input.type}\n${input.msgSvrId}`;
  }
  return `wechat/v1\n${input.talker}\n${input.type}\nct=${input.createTime}\n${sha256Hex(input.content)}`;
}

export function webhookDedupPreimage(eventId: string): string {
  return `webhook/v1\n${eventId}`;
}
