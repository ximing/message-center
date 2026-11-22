export interface IsolatedDbContext {
  available: boolean;
  schemaName?: string;
  reason?: string;
}

declare module 'vitest' {
  interface ProvidedContext {
    isolatedDb: IsolatedDbContext;
  }
}

interface GlobalSetupContextLike {
  provide: (key: 'isolatedDb', value: IsolatedDbContext) => void;
}

export default async function globalSetup({ provide }: GlobalSetupContextLike) {
  process.env.NODE_ENV = 'test';
  try {
    const { assertMigrationsPresent, createIsolatedDb, dropIsolatedDb } = await import('./isolated-db.js');
    await assertMigrationsPresent();
    const iso = await createIsolatedDb('mc');
    provide('isolatedDb', { available: true, schemaName: iso.schemaName });
    await iso.pool.end();
    return async () => {
      await dropIsolatedDb(iso.schemaName).catch((err: unknown) => {
        const name = err instanceof Error ? err.name : 'Error';
        console.error(`drop isolated schema ${iso.schemaName} failed: ${name}`);
      });
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[testkit] isolated PG unavailable, DB tests will be skipped: ${reason}`);
    provide('isolatedDb', { available: false, reason });
    return undefined;
  }
}
