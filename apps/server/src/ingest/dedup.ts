import { createHash } from 'node:crypto';

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Decimal msgSvrId that selects the server-id dedup preimage. Zero and negatives use createTime. */
export function positiveMsgSvrId(value: string): boolean {
  return /^[1-9]\d{0,18}$/.test(value);
}

/** Preimage whose sha256 is both dedup_key and the Vital Idempotency-Key. */
export function wechatDedupPreimage(input: {
  talker: string;
  type: number;
  msgSvrId: string;
  createTime: number;
  content: string;
}): string {
  if (positiveMsgSvrId(input.msgSvrId)) {
    return `wechat/v1\n${input.talker}\n${input.type}\n${input.msgSvrId}`;
  }
  return `wechat/v1\n${input.talker}\n${input.type}\nct=${input.createTime}\n${sha256Hex(input.content)}`;
}

export function webhookDedupPreimage(eventId: string): string {
  return `webhook/v1\n${eventId}`;
}
