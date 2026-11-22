import { assertDatabaseName } from '../config.js';
import { pool } from './index.js';
import { applyMigrations, migrationsFolder } from './migrator.js';

try {
  assertDatabaseName('message_center_dev');
  console.log(`applying migrations from ${migrationsFolder}`);
  await applyMigrations();
  console.log('migrations applied');
} catch (err) {
  const name = err instanceof Error ? err.name : 'Error';
  console.error(`migration failed: ${name}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
