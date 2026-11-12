/**
 * Course git-versioning tables only.
 * org_id / user_id columns are UUID references without FK to auth tables yet;
 * auth worker owns users/orgs — wire FKs when that schema lands.
 */
import type { CourseTree } from '@lp/domain';
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id'),
    ownerUserId: uuid('owner_user_id'),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    defaultBranch: text('default_branch').notNull().default('main'),
    publishedCommitId: uuid('published_commit_id'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('courses_org_slug_alive_uidx')
      .on(t.orgId, t.slug)
      .where(sql`${t.deletedAt} is null and ${t.orgId} is not null`),
    uniqueIndex('courses_owner_user_slug_alive_uidx')
      .on(t.ownerUserId, t.slug)
      .where(sql`${t.deletedAt} is null and ${t.ownerUserId} is not null`),
    index('courses_org_id_idx').on(t.orgId),
    index('courses_owner_user_id_idx').on(t.ownerUserId),
  ],
);

export const courseBranches = pgTable(
  'course_branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    name: text('name').notNull(),
    headCommitId: uuid('head_commit_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('course_branches_course_name_uidx').on(t.courseId, t.name)],
);

export const courseSnapshots = pgTable(
  'course_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tree: jsonb('tree').$type<CourseTree>().notNull(),
    contentHash: text('content_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('course_snapshots_content_hash_uidx').on(t.contentHash)],
);

export const courseCommits = pgTable(
  'course_commits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    branchIdAtCreate: uuid('branch_id_at_create')
      .notNull()
      .references(() => courseBranches.id),
    parentIds: uuid('parent_ids').array().notNull().default([]),
    message: text('message').notNull(),
    authorId: uuid('author_id').notNull(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => courseSnapshots.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('course_commits_course_id_idx').on(t.courseId)],
);

export const courseWorkingTrees = pgTable(
  'course_working_trees',
  {
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => courseBranches.id),
    baseCommitId: uuid('base_commit_id'),
    dirtyTree: jsonb('dirty_tree').$type<CourseTree>().notNull(),
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.branchId] })],
);
