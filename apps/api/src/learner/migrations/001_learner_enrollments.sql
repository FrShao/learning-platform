-- Learner-owned schema: enrollments
-- Prefix: learner_ migration filenames; table names match domain models.

CREATE TABLE IF NOT EXISTS enrollments (
  id              uuid PRIMARY KEY,
  course_id       uuid NOT NULL,
  user_id         uuid NOT NULL,
  org_id          uuid NOT NULL,
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_course_user_uidx
  ON enrollments (course_id, user_id);

CREATE INDEX IF NOT EXISTS enrollments_user_idx
  ON enrollments (user_id);

CREATE INDEX IF NOT EXISTS enrollments_org_idx
  ON enrollments (org_id);
