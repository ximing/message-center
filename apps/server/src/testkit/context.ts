import { inject } from 'vitest';
import type { Database } from '../db/index.js';
import { setDb } from '../db/index.js';
import { closeIsolatedDb, connectIsolatedDb, type IsolatedDb } from './isolated-db.js';
import type { IsolatedDbContext } from './global-setup.js';

export function isolatedDbContext(): IsolatedDbContext {
  return inject('isolatedDb');
}

export async function setupIsolatedDb(): Promise<IsolatedDb> {
  const ctx = isolatedDbContext();
  if (!ctx.available || !ctx.schemaName) {
    throw new Error(`isolated db unavailable: ${ctx.reason ?? 'unknown'}`);
  }
  const iso = connectIsolatedDb(ctx.schemaName);
  setDb(iso.db);
  return iso;
}

export async function teardownIsolatedDb(iso: IsolatedDb): Promise<void> {
  setDb(null);
  await closeIsolatedDb(iso);
}

export type { Database };
