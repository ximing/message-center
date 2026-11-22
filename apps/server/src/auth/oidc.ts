const REQUIRED = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
  'OIDC_REDIRECT_URI',
  'OIDC_AUDIENCE',
] as const;

export type OidcEnv = Partial<Record<(typeof REQUIRED)[number], string | undefined>>;

/** Enabled only when all five fields are non-blank. Does not call Keycloak. */
export function oidcEnabled(env: OidcEnv): boolean {
  return REQUIRED.every((name) => {
    const value = env[name];
    return typeof value === 'string' && value.trim().length > 0;
  });
}
