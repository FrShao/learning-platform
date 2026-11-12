-- Courses and paths may be owned by a user (personal) or an organization.
-- Exactly one of org_id / owner_user_id is set (XOR).

-- courses -------------------------------------------------------------------
ALTER TABLE courses ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS owner_user_id uuid;

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_owner_xor_chk;
ALTER TABLE courses ADD CONSTRAINT courses_owner_xor_chk CHECK (
  (org_id IS NOT NULL AND owner_user_id IS NULL)
  OR (org_id IS NULL AND owner_user_id IS NOT NULL)
);

DROP INDEX IF EXISTS courses_org_slug_alive_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS courses_org_slug_alive_uidx
  ON courses (org_id, slug)
  WHERE deleted_at IS NULL AND org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS courses_owner_user_slug_alive_uidx
  ON courses (owner_user_id, slug)
  WHERE deleted_at IS NULL AND owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS courses_owner_user_id_idx ON courses (owner_user_id);

-- learning_paths ------------------------------------------------------------
ALTER TABLE learning_paths ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE learning_paths ADD COLUMN IF NOT EXISTS owner_user_id uuid;

ALTER TABLE learning_paths DROP CONSTRAINT IF EXISTS learning_paths_owner_xor_chk;
ALTER TABLE learning_paths ADD CONSTRAINT learning_paths_owner_xor_chk CHECK (
  (org_id IS NOT NULL AND owner_user_id IS NULL)
  OR (org_id IS NULL AND owner_user_id IS NOT NULL)
);

DROP INDEX IF EXISTS learning_paths_org_slug_alive_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS learning_paths_org_slug_alive_uidx
  ON learning_paths (org_id, slug)
  WHERE deleted_at IS NULL AND org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS learning_paths_owner_user_slug_alive_uidx
  ON learning_paths (owner_user_id, slug)
  WHERE deleted_at IS NULL AND owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS learning_paths_owner_user_id_idx ON learning_paths (owner_user_id);

-- path enrollments: org_id denormalized; null for personal paths ------------
ALTER TABLE path_enrollments ALTER COLUMN org_id DROP NOT NULL;
