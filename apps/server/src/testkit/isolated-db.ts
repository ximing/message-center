import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { assertDatabaseName, config } from '../config.js';
import type { Database } from '../db/index.js';
import * as schema from '../db/schema.js';

/**
 * Each vitest run creates a schema in message_center_test, applies drizzle SQL
 * with "public" rewritten to that schema, then drops it. Dev and prod are untouched.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.resolve(here, '../../drizzle');

export interface IsolatedDb {
  schemaName: string;
  pool: Pool;
  db: Database;
}

function poolConfigFor(schemaName: string | null) {
  return {
    host: config.PG_HOST,
    port: config.PG_PORT,
    user: config.PG_USER,
    password: config.PG_PASSWORD,
    database: config.PG_DATABASE,
    max: 6,
    idleTimeoutMillis: 1000,
    allowExitOnIdle: true,
    ...(config.PG_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
    ...(schemaName ? { options: `-c search_path=${schemaName}` } : {}),
  };
}

async function applyMigrations(pool: Pool, schemaName: string): Promise<void> {
  const journalRaw = await readFile(path.join(drizzleDir, 'meta/_journal.json'), 'utf8');
  const journal = JSON.parse(journalRaw) as { entries: { tag: string }[] };
  for (const entry of journal.entries) {
    const file = path.join(drizzleDir, `${entry.tag}.sql`);
    const raw = await readFile(file, 'utf8');
    const sqlText = raw.replaceAll('"public".', `"${schemaName}".`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path = "${schemaName}"`);
      await client.query(sqlText);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      const name = err instanceof Error ? err.name : 'Error';
      throw new Error(`migration ${entry.tag} failed in ${schemaName}: ${name}`);
    } finally {
      client.release();
    }
  }
}

export async function createIsolatedDb(prefix = 'mc'): Promise<IsolatedDb> {
  assertDatabaseName('message_center_test');
  const schemaName = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new Pool(poolConfigFor(null));
  try {
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
  } finally {
    await admin.end();
  }
  const pool = new Pool(poolConfigFor(schemaName));
  try {
    await applyMigrations(pool, schemaName);
  } catch (err) {
    await pool.end().catch(() => undefined);
    const cleanup = new Pool(poolConfigFor(null));
    await cleanup.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => undefined);
    await cleanup.end().catch(() => undefined);
    throw err;
  }
  return { schemaName, pool, db: drizzle(pool, { schema }) as Database };
}

export function connectIsolatedDb(schemaName: string): IsolatedDb {
  assertDatabaseName('message_center_test');
  const pool = new Pool(poolConfigFor(schemaName));
  return { schemaName, pool, db: drizzle(pool, { schema }) as Database };
}

export async function closeIsolatedDb(iso: IsolatedDb): Promise<void> {
  await iso.pool.end();
}

export async function dropIsolatedDb(schemaName: string): Promise<void> {
  assertDatabaseName('message_center_test');
  const admin = new Pool(poolConfigFor(null));
  try {
    await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await admin.end();
  }
}

export async function assertMigrationsPresent(): Promise<void> {
  const files = await readdir(drizzleDir);
  if (!files.some((name) => name.endsWith('.sql'))) {
    throw new Error(`no drizzle migrations found in ${drizzleDir}`);
  }
}
