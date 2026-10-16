-- Hash license keys at rest: lookups match sha256(key + LICENSE_PEPPER).
-- Deploy order for databases that already hold raw keys:
--   1. apply this migration (adds the hash column + index),
--   2. run scripts/hash-licenses.mjs with LICENSE_PEPPER set,
--   3. verify every row has a hash,
--   4. apply 0005_drop_raw_licenses.sql.
-- Fresh databases apply both files together; the script then no-ops.

ALTER TABLE students ADD COLUMN IF NOT EXISTS license_key_hash text;

-- One live license per hash: NULLs (demo students) never collide, and
-- revoked rows are excluded so a re-purchase can re-provision cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS students_license_hash_idx
  ON students(license_key_hash) WHERE revoked_at IS NULL;
