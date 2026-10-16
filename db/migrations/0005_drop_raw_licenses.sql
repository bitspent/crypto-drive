-- Drop raw license keys. Apply only after the 0004 backfill is verified
-- (see 0004 header): once this runs, unhashed keys are unrecoverable.
-- Decision: drop, don't keep-for-audit — a populated raw column would
-- defeat the purpose of hashing at rest.

ALTER TABLE students DROP COLUMN IF EXISTS license_key;
