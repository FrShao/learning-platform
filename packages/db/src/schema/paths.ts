/**
 * Learning path tables: org-owned journeys as single-parent node trees.
 * Lesson refs are (course_id, section_id); course_id is UUID without FK until
 * cross-schema FKs are wired; section_id is a stable tree section id (text).
 */
import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const learningPaths = pgTable(
  'learning_paths',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('learning_paths_org_slug_alive_uidx')
      .on(t.orgId, t.slug)
      .where(sql`${t.deletedAt} is null`),
    index('learning_paths_org_id_idx').on(t.orgId),
  ],
);

export const pathNodes = pgTable(
  'path_nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pathId: uuid('path_id')
      .notNull()
      .references(() => learningPaths.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    title: text('title'),
    order: integer('order').notNull().default(0),
    courseId: uuid('course_id').notNull(),
    sectionId: text('section_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('path_nodes_path_id_idx').on(t.pathId),
    index('path_nodes_parent_id_idx').on(t.parentId),
  ],
);

export const pathEnrollments = pgTable(
  'path_enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pathId: uuid('path_id')
      .notNull()
      .references(() => learningPaths.id),
    userId: uuid('user_id').notNull(),
    orgId: uuid('org_id').notNull(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('path_enrollments_path_user_uidx').on(t.pathId, t.userId),
    index('path_enrollments_user_id_idx').on(t.userId),
  ],
);

export const pathProgress = pgTable('path_progress', {
  enrollmentId: uuid('enrollment_id')
    .primaryKey()
    .references(() => pathEnrollments.id, { onDelete: 'cascade' }),
  completedNodeIds: uuid('completed_node_ids').array().notNull().default([]),
  currentNodeId: uuid('current_node_id'),
  percent: integer('percent').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
