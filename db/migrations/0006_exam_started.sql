-- Exam attempt binding: evidence older than the attempt start never counts.
-- Set once, on first exam-step load; never reset (no time pressure, no expiry).

ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_started_at timestamptz;
