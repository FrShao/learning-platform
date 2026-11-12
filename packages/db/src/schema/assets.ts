/**
 * Org-scoped asset blobs referenced by image content blocks.
 */
import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('assets_storage_key_uidx').on(t.storageKey),
    index('assets_org_id_idx').on(t.orgId),
    index('assets_org_alive_idx')
      .on(t.orgId)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export type AssetRow = typeof assets.$inferSelect;
export type NewAssetRow = typeof assets.$inferInsert;
