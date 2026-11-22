const IMAGE_TYPES = new Set([3, 13, 23, 33, 39]);

export type WechatKind = 'text' | 'link' | 'image' | 'voice';

export function classifyWechatType(type: number): WechatKind | null {
  if (type === 1) return 'text';
  if ((type & 0xffff) === 49) return 'link';
  if (IMAGE_TYPES.has(type)) return 'image';
  if (type === 34) return 'voice';
  return null;
}

/** Same cleaning as WechatMsgHook GroupMessage.normalize. */
export function normalizeWechatValue(value: string | null | undefined): string {
  if (value == null) return '';
  const normalized = value.trim();
  if (normalized.length === 0) return '';
  if (normalized.toLowerCase() === 'null') return '';
  if (normalized === '(err)') return '';
  return normalized;
}

export interface GroupParse {
  group: boolean;
  talker: string;
  sender: string;
  body: string;
}

/** Port of WechatMsgHook GroupMessage.parse. */
export function parseGroupMessage(talker: string, raw: string): GroupParse {
  const normalizedTalker = normalizeWechatValue(talker);
  const normalized = normalizeWechatValue(raw);
  if (!normalizedTalker.endsWith('@chatroom')) {
    return { group: false, talker: normalizedTalker, sender: '', body: normalized };
  }
  if (normalized.length === 0) {
    return { group: true, talker: normalizedTalker, sender: '', body: '' };
  }

  let split = normalized.indexOf(':\n');
  let delimiterLen = 2;
  if (split < 0) {
    split = normalized.indexOf(':');
    delimiterLen = 1;
  }
  if (split <= 0) {
    return { group: true, talker: normalizedTalker, sender: '', body: normalized };
  }

  const senderCandidate = normalizeWechatValue(normalized.slice(0, split));
  if (!(senderCandidate.startsWith('wxid_') || senderCandidate.includes('@'))) {
    return { group: true, talker: normalizedTalker, sender: '', body: normalized };
  }
  const body =
    split + delimiterLen >= normalized.length
      ? ''
      : normalizeWechatValue(normalized.slice(split + delimiterLen));
  return { group: true, talker: normalizedTalker, sender: senderCandidate, body };
}

export interface NormalizedWechat {
  sender: string;
  room: string | null;
  body: string;
}

/** Group sender comes from the prefix. DM sender is fromUser, else talker. Room is only the chatroom talker. */
export function normalizeWechatMessage(input: {
  talker: string;
  fromUser: string;
  content: string;
}): NormalizedWechat {
  const parsed = parseGroupMessage(input.talker, input.content);
  if (parsed.group) {
    return {
      sender: parsed.sender,
      room: parsed.talker,
      body: parsed.body,
    };
  }
  const from = normalizeWechatValue(input.fromUser);
  const talker = normalizeWechatValue(input.talker);
  return {
    sender: from || talker,
    room: null,
    body: parsed.body,
  };
}
