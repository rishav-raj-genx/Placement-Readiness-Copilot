/*
# Create interview_sessions table for LiveKit mock interviews

## Purpose
Stores persistent records of LiveKit-based mock interview sessions, including
the LiveKit room name, interview metadata, status, and final results from the
mock-interview worker.

## New Tables
- `interview_sessions`
  - `id` (text, primary key — e.g. "intv_<timestamp>")
  - `user_id` (uuid, not null — references auth.users, the student)
  - `livekit_room_name` (text, not null — the LiveKit room name)
  - `target_role` (text, not null — the role being interviewed for)
  - `job_id` (text, nullable — optional job reference)
  - `resume_id` (text, nullable — optional resume identifier)
  - `config` (jsonb, not null — full interview config: topics, difficulty, duration, etc.)
  - `room_metadata` (jsonb, nullable — snapshot of the metadata set on the LiveKit room)
  - `status` (text, not null, default 'created' — one of: created, active, completed, abandoned, error)
  - `result` (jsonb, nullable — final result payload from the worker)
  - `started_at` (timestamptz, nullable)
  - `completed_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `interview_sessions`.
- Students can read, create, update, and delete only their own interview sessions.
- All policies use auth.uid() = user_id for ownership checks.
- user_id defaults to auth.uid() so inserts from authenticated clients work
  even when the client omits user_id.
*/

CREATE TABLE IF NOT EXISTS interview_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  livekit_room_name text NOT NULL,
  target_role text NOT NULL,
  job_id text,
  resume_id text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  room_metadata jsonb,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'completed', 'abandoned', 'error')),
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_interview_sessions" ON interview_sessions;
CREATE POLICY "select_own_interview_sessions"
  ON interview_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_interview_sessions" ON interview_sessions;
CREATE POLICY "insert_own_interview_sessions"
  ON interview_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_interview_sessions" ON interview_sessions;
CREATE POLICY "update_own_interview_sessions"
  ON interview_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('in_progress', 'abandoned', 'cancelled')
  );

-- Client DELETE is disabled for auditing and retention compliance.
DROP POLICY IF EXISTS "delete_own_interview_sessions" ON interview_sessions;

-- Prevent students from altering finalized results or scoring via database API
CREATE OR REPLACE FUNCTION public.check_interview_session_client_update()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user = 'service_role' OR (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.result IS DISTINCT FROM OLD.result THEN
    RAISE EXCEPTION 'Clients cannot modify interview result directly.';
  END IF;
  IF NEW.score IS DISTINCT FROM OLD.score THEN
    RAISE EXCEPTION 'Clients cannot modify interview score directly.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_interview_session_result ON interview_sessions;
CREATE TRIGGER trg_protect_interview_session_result
  BEFORE UPDATE ON interview_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_interview_session_client_update();

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);