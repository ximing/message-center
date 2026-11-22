import { sql, type SQLWrapper } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { DELIVERY_STATUSES, EGRESS_PROVIDERS, INGRESS_CHANNELS, MESSAGE_KINDS } from '@mc/dto';

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

const enumCheck = (name: string, column: SQLWrapper, values: readonly string[]) =>
  check(name, sql`${column} IN (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 64 }),
  sessionVersion: integer('session_version').notNull().default(0),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const oidcIdentities = pgTable(
  'oidc_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    issuer: varchar('issuer', { length: 512 }).notNull(),
    sub: varchar('sub', { length: 255 }).notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('oidc_identities_issuer_sub_uidx').on(t.issuer, t.sub),
    uniqueIndex('oidc_identities_user_issuer_uidx').on(t.userId, t.issuer),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    note: varchar('note', { length: 500 }).notNull().default(''),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    tokenEncrypted: text('token_encrypted').notNull(),
    tokenPreview: varchar('token_preview', { length: 32 }).notNull(),
    lastUsedAt: timestamptz('last_used_at'),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_api_keys_user').on(t.userId),
    uniqueIndex('api_keys_hash_uidx').on(t.tokenHash),
  ],
);

export const accessTokens = pgTable(
  'access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    tokenEncrypted: text('token_encrypted').notNull(),
    tokenPreview: varchar('token_preview', { length: 32 }).notNull(),
    lastUsedAt: timestamptz('last_used_at'),
    revokedAt: timestamptz('revoked_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_access_tokens_user').on(t.userId),
    uniqueIndex('access_tokens_hash_uidx').on(t.tokenHash),
  ],
);

export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 16 }).notNull(),
    label: varchar('label', { length: 64 }).notNull(),
    apiBase: varchar('api_base', { length: 512 }).notNull(),
    tokenEncrypted: text('token_encrypted').notNull(),
    tokenPreview: varchar('token_preview', { length: 32 }).notNull(),
    remoteUserId: varchar('remote_user_id', { length: 255 }).notNull(),
    remoteDisplayName: varchar('remote_display_name', { length: 255 }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    allowImage: boolean('allow_image').notNull().default(false),
    allowVoice: boolean('allow_voice').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_connections_user').on(t.userId),
    enumCheck('connections_provider_check', t.provider, EGRESS_PROVIDERS),
    enumCheck('connections_status_check', t.status, ['active', 'unauthorized']),
  ],
);

export const forwardRules = pgTable(
  'forward_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 64 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    exclusive: boolean('exclusive').notNull().default(false),
    matchIngress: varchar('match_ingress', { length: 16 }),
    matchRoom: varchar('match_room', { length: 256 }),
    matchSender: varchar('match_sender', { length: 256 }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'restrict' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_forward_rules_user').on(t.userId),
    check(
      'forward_rules_match_ingress_check',
      sql`${t.matchIngress} IS NULL OR ${t.matchIngress} IN (${sql.raw(
        INGRESS_CHANNELS.map((value) => `'${value}'`).join(', '),
      )})`,
    ),
  ],
);

export const inboundMessages = pgTable(
  'inbound_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ingress: varchar('ingress', { length: 16 }).notNull(),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'restrict' }),
    dedupKey: varchar('dedup_key', { length: 64 }).notNull(),
    sender: varchar('sender', { length: 256 }).notNull().default(''),
    room: varchar('room', { length: 256 }),
    kind: varchar('kind', { length: 16 }).notNull(),
    body: text('body').notNull(),
    rawRef: varchar('raw_ref', { length: 512 }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_inbound_messages_user_created').on(t.userId, t.createdAt),
    uniqueIndex('inbound_messages_user_dedup_uidx').on(t.userId, t.dedupKey),
    enumCheck('inbound_messages_ingress_check', t.ingress, INGRESS_CHANNELS),
    enumCheck('inbound_messages_kind_check', t.kind, MESSAGE_KINDS),
  ],
);

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => inboundMessages.id, { onDelete: 'cascade' }),
    ruleId: uuid('rule_id').references(() => forwardRules.id, { onDelete: 'restrict' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 32 }).notNull(),
    skipReason: varchar('skip_reason', { length: 64 }),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamptz('next_attempt_at'),
    remoteId: varchar('remote_id', { length: 255 }),
    httpStatus: integer('http_status'),
    errorCode: varchar('error_code', { length: 64 }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('deliveries_message_connection_uidx').on(t.messageId, t.connectionId),
    index('idx_deliveries_status_next').on(t.status, t.nextAttemptAt),
    enumCheck('deliveries_status_check', t.status, DELIVERY_STATUSES),
    check(
      'deliveries_skip_reason_check',
      sql`${t.skipReason} IS NULL OR ${t.skipReason} IN ('media_disabled', 'media_transport_pending')`,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type AccessTokenRow = typeof accessTokens.$inferSelect;
export type ConnectionRow = typeof connections.$inferSelect;
export type ForwardRuleRow = typeof forwardRules.$inferSelect;
export type InboundMessageRow = typeof inboundMessages.$inferSelect;
export type DeliveryRow = typeof deliveries.$inferSelect;
