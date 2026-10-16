-- Crypto Drive initial schema (Supabase Postgres / any Postgres 14+).
-- Apply via the Supabase SQL editor, or locally with scripts/db-test-setup.mjs.
--
-- Notes vs. the file store it replaces:
-- * students.license_key is NULLABLE: demo licenses are never stored
--   (only their practice-seed hash); Prompt 3 backfills generated keys.
-- * students.practice_seed is NULLABLE for legacy rows; unlock backfills it.
-- * students.unlocked_at is students.created_at (never displayed; set at insert).
-- * The deprecated Student.module1PassedAt has no column: the file
--   migration folds it into modules_passed with the same legacy rule.
-- * sessions.expires_at is enforced (expired sessions read as signed out).
-- * certificates.revoked_at is reserved; nothing checks it yet.

CREATE TABLE IF NOT EXISTS students (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  license_key text,
  tier text NOT NULL,
  practice_seed text,
  modules_passed jsonb NOT NULL DEFAULT '{}',
  wallet jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id text PRIMARY KEY,
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  track_slug text NOT NULL,
  module_slug text NOT NULL,
  module_label text NOT NULL,
  milestone text NOT NULL,
  hash text NOT NULL,
  student_name text NOT NULL,
  email text NOT NULL,
  tier text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS students_email_idx ON students(email);
CREATE INDEX IF NOT EXISTS sessions_student_idx ON sessions(student_id);
CREATE INDEX IF NOT EXISTS certificates_student_idx ON certificates(student_id);
