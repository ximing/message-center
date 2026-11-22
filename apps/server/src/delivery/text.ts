import type { IngressChannel } from '@mc/dto';
import { extractXmlTag } from '../wechat/xml.js';

export function clipUnits(value: string, max: number): string {
  if (max <= 0) return '';
  if (value.length <= max) return value;
  let end = max;
  const prev = value.charCodeAt(end - 1);
  if (prev !== undefined && prev >= 0xd800 && prev <= 0xdbff) end -= 1;
  if (end < 0) return '';
  return value.slice(0, end);
}

export function titleFromBody(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return clipUnits(trimmed, 500);
  }
  return clipUnits(body.trim(), 500);
}

/** http(s), length <= 2048, no whitespace. Matches the Vital link check. */
export function isLegalHttpUrl(url: string): boolean {
  if (url.length === 0 || url.length > 2048) return false;
  if (!(url.startsWith('http://') || url.startsWith('https://'))) return false;
  return !/\s/u.test(url);
}

export function bylineFor(sender: string, room: string | null): string | null {
  let line = '';
  if (room && sender) line = `${sender} · ${room}`;
  else if (sender) line = sender;
  else if (room) line = room;
  const clipped = clipUnits(line, 200);
  return clipped.length === 0 ? null : clipped;
}

export function siteNameFor(ingress: IngressChannel): string {
  return ingress === 'wechat' ? '微信' : 'Webhook';
}

export function sourceFor(ingress: IngressChannel): 'wechat' | 'manual' {
  return ingress === 'wechat' ? 'wechat' : 'manual';
}

export interface LinkParts {
  title: string;
  url: string;
  text: string;
}

export function encodeLinkBody(link: LinkParts): string {
  return JSON.stringify({ title: link.title, url: link.url, text: link.text });
}

export function linkParts(body: string): LinkParts {
  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (typeof record.url === 'string') {
        return {
          title: typeof record.title === 'string' ? record.title : '',
          url: record.url,
          text: typeof record.text === 'string' ? record.text : '',
        };
      }
    }
  } catch {
    // Plain text or WeChat XML.
  }
  return {
    title: extractXmlTag(body, 'title'),
    url: extractXmlTag(body, 'url'),
    text: body,
  };
}
