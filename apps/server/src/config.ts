import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Test runs load only .env.test: falling back to the dev .env would leak real
// service credentials into the test environment.
loadEnv({
  path:
    process.env.NODE_ENV === 'test'
      ? [path.join(serverRoot, '.env.test')]
      : [
          path.join(serverRoot, `.env.${process.env.NODE_ENV ?? 'development'}`),
          path.join(serverRoot, '.env'),
        ],
});

// Remote PG may try GSSAPI encryption and fail; node-pg honors this libpq env.
process.env.PGGSSENCMODE ??= 'disable';

const boolEnum = z.enum(['true', 'false']).transform((value) => value === 'true');

const blankToUndef = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalNonEmpty = z.preprocess(blankToUndef, z.string().min(1).optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3030),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PG_HOST: z.string().min(1),
  PG_PORT: z.coerce.number().default(5432),
  PG_USER: z.string().min(1),
  PG_PASSWORD: z.string().min(1),
  PG_DATABASE: z.string().min(1),
  // Never z.coerce.boolean(): the string 'false' would become true.
  PG_SSL: boolEnum.default('false'),
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SECRET_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'SECRET_ENCRYPTION_KEY must be 32-byte hex'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5191'),
  OIDC_ISSUER: optionalNonEmpty,
  OIDC_CLIENT_ID: optionalNonEmpty,
  OIDC_CLIENT_SECRET: optionalNonEmpty,
  OIDC_REDIRECT_URI: optionalNonEmpty,
  OIDC_AUDIENCE: optionalNonEmpty,
  OIDC_SCOPES: optionalNonEmpty,
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;

export function assertDatabaseName(
  expected: 'message_center_dev' | 'message_center_test' | 'message_center_prod',
): void {
  const name = config.PG_DATABASE;
  if (name !== expected || name.startsWith('inwit') || name.startsWith('vital')) {
    throw new Error(`refusing database ${name}, expected ${expected}`);
  }
}
