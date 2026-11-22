import type { EgressProvider } from '@mc/dto';

export const DEFAULT_API_BASE: Record<EgressProvider, string> = {
  vital: 'https://vital.aimo.plus',
  aimo: 'https://aimo.plus',
  inwit: 'https://inwit.aimo.plus',
};

const TOKEN_PREFIX: Record<EgressProvider, string> = {
  vital: 'vt_',
  aimo: 'aimo_tk_',
  inwit: 'iwt_',
};

/** https origin only: no userinfo, path, query, or fragment. One trailing slash is stripped. */
export function normalizeApiBase(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  return url.origin;
}

export function tokenPrefixOk(provider: EgressProvider, token: string): boolean {
  return token.startsWith(TOKEN_PREFIX[provider]);
}

export function resolveApiBase(provider: EgressProvider, raw: string | undefined): string | null {
  return normalizeApiBase(raw ?? DEFAULT_API_BASE[provider]);
}
