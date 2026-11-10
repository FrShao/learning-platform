-- Course git-versioning schema (courses-only).
-- Auth tables (users/orgs) are owned elsewhere; org_id/created_by/author_id/updated_by
-- are UUID columns without FK until auth schema is available to attach.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  default_branch text NOT NULL DEFAULT 'main',
  published_commit_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS courses_org_slug_alive_uidx
  ON courses (org_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS courses_org_id_idx ON courses (org_id);

CREATE TABLE IF NOT EXISTS course_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses (id),
  name text NOT NULL,
  head_commit_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS course_branches_course_name_uidx
  ON course_branches (course_id, name);

CREATE TABLE IF NOT EXISTS course_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS course_snapshots_content_hash_uidx
  ON course_snapshots (content_hash);

CREATE TABLE IF NOT EXISTS course_commits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses (id),
  branch_id_at_create uuid NOT NULL REFERENCES course_branches (id),
  parent_ids uuid[] NOT NULL DEFAULT '{}',
  message text NOT NULL,
  author_id uuid NOT NULL,
  snapshot_id uuid NOT NULL REFERENCES course_snapshots (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_commits_course_id_idx ON course_commits (course_id);

-- Head / published commit FKs added after course_commits exists
ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_published_commit_id_fkey;
ALTER TABLE courses
  ADD CONSTRAINT courses_published_commit_id_fkey
  FOREIGN KEY (published_commit_id) REFERENCES course_commits (id);

ALTER TABLE course_branches
  DROP CONSTRAINT IF EXISTS course_branches_head_commit_id_fkey;
ALTER TABLE course_branches
  ADD CONSTRAINT course_branches_head_commit_id_fkey
  FOREIGN KEY (head_commit_id) REFERENCES course_commits (id);

CREATE TABLE IF NOT EXISTS course_working_trees (
  course_id uuid NOT NULL REFERENCES courses (id),
  branch_id uuid NOT NULL REFERENCES course_branches (id),
  base_commit_id uuid REFERENCES course_commits (id),
  dirty_tree jsonb NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, branch_id)
);
