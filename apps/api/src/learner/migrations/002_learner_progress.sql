-- Learner-owned schema: learner_progress (1:1 with enrollment)

CREATE TABLE IF NOT EXISTS learner_progress (
  enrollment_id         uuid PRIMARY KEY REFERENCES enrollments (id),
  published_commit_id   uuid NOT NULL,
  completed_section_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_section_id    text NULL,
  percent               numeric(5, 2) NOT NULL DEFAULT 0
                        CHECK (percent >= 0 AND percent <= 100),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learner_progress_commit_idx
  ON learner_progress (published_commit_id);
