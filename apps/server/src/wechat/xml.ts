function decodeXmlEntities(value: string): string {
  const decoded = value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
  return decoded.replace(/&#(x[0-9a-fA-F]+|[0-9]+);/g, (entity, code: string) => {
    const point = code.startsWith('x') || code.startsWith('X') ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
    if (!Number.isFinite(point) || point < 0 || point > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(point);
    } catch {
      return entity;
    }
  });
}

function stripCData(value: string): string {
  const normalized = value.trim();
  if (normalized.startsWith('<![CDATA[') && normalized.endsWith(']]>') && normalized.length >= 12) {
    return normalized.slice(9, -3).trim();
  }
  return normalized;
}

export function extractXmlTag(xml: string, tag: string): string {
  if (!xml) return '';
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = pattern.exec(xml);
  const raw = match?.[1];
  if (raw == null) return '';
  return stripCData(decodeXmlEntities(raw));
}
