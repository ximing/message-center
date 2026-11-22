import { eq, sql } from 'drizzle-orm';
import { getDb, type Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { AppError } from '../errors.js';

type RevisionWriter = Pick<Database, 'update'>;

export async function bumpLiveRevision(writer: RevisionWriter, userId: string): Promise<void> {
  await writer
    .update(users)
    .set({ liveRevision: sql`${users.liveRevision} + 1` })
    .where(eq(users.id, userId));
}

export async function readLiveRevision(userId: string): Promise<bigint> {
  const [row] = await getDb()
    .select({ liveRevision: users.liveRevision })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw AppError.of(401, 'INVALID_TOKEN');
  return row.liveRevision;
}
