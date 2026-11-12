-- Learning paths: org-owned lesson trees (mutable definitions pointing at course sections).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS learning_paths_org_slug_alive_uidx
  ON learning_paths (org_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS learning_paths_org_id_idx ON learning_paths (org_id);

CREATE TABLE IF NOT EXISTS path_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES learning_paths (id) ON DELETE CASCADE,
  parent_id uuid REFERENCES path_nodes (id) ON DELETE CASCADE,
  title text,
  "order" integer NOT NULL DEFAULT 0,
  course_id uuid NOT NULL,
  section_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS path_nodes_path_id_idx ON path_nodes (path_id);
CREATE INDEX IF NOT EXISTS path_nodes_parent_id_idx ON path_nodes (parent_id);
-- Sibling order uniqueness is enforced in domain (validatePathTree / normalizeSiblingOrders).

CREATE TABLE IF NOT EXISTS path_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES learning_paths (id),
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS path_enrollments_path_user_uidx
  ON path_enrollments (path_id, user_id);

CREATE INDEX IF NOT EXISTS path_enrollments_user_id_idx ON path_enrollments (user_id);

CREATE TABLE IF NOT EXISTS path_progress (
  enrollment_id uuid PRIMARY KEY REFERENCES path_enrollments (id) ON DELETE CASCADE,
  completed_node_ids uuid[] NOT NULL DEFAULT '{}',
  current_node_id uuid,
  percent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
