export function headerString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function readBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const trimmed = authorization.trim();
  if (!/^Bearer\s+/i.test(trimmed)) return undefined;
  const token = trimmed.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 ? token : undefined;
}
