-- Learner-owned schema: form_attempts

CREATE TABLE IF NOT EXISTS form_attempts (
  id                    uuid PRIMARY KEY,
  enrollment_id         uuid NOT NULL REFERENCES enrollments (id),
  section_id            text NOT NULL,
  form_block_id         text NOT NULL,
  published_commit_id   uuid NOT NULL,
  answers               jsonb NOT NULL,
  score                 numeric(6, 5) NULL
                        CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  passed                boolean NULL,
  grades                jsonb NOT NULL DEFAULT '[]'::jsonb,
  graded_at             timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_attempts_enrollment_form_commit_idx
  ON form_attempts (enrollment_id, form_block_id, published_commit_id);

CREATE INDEX IF NOT EXISTS form_attempts_enrollment_idx
  ON form_attempts (enrollment_id);
