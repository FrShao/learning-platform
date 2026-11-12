-- Org-scoped asset blobs for image blocks (storage_key → local FS or S3).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL CHECK (size > 0),
  storage_key text NOT NULL,
  original_filename text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS assets_storage_key_uidx ON assets (storage_key);

CREATE INDEX IF NOT EXISTS assets_org_id_idx ON assets (org_id);
