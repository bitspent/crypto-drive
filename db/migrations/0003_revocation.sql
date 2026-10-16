-- Revocation: refunds, disputes, and cancellations disable the student row.
-- Sessions for revoked students are deleted on next use (getSessionAccess);
-- unlock refuses revoked licenses outright.

ALTER TABLE students ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS revocation_reason text;

CREATE INDEX IF NOT EXISTS students_revoked_idx
  ON students(revoked_at) WHERE revoked_at IS NOT NULL;
