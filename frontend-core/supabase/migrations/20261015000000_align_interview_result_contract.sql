/*
  Align interview_sessions with the v0 worker/readiness contract.
  Missing results must remain NULL, never become a valid 0 score.
*/

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS student_id text DEFAULT auth.uid()::text;

UPDATE interview_sessions
SET student_id = user_id::text
WHERE student_id IS NULL AND user_id IS NOT NULL;

ALTER TABLE interview_sessions
  ALTER COLUMN student_id SET NOT NULL;

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS contract_version text
    GENERATED ALWAYS AS (result->>'contract_version') STORED;

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS interview_score numeric(5, 2)
    GENERATED ALWAYS AS (
      NULLIF(result->>'interview_score', '')::numeric
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_student_created
  ON interview_sessions(student_id, created_at DESC);
