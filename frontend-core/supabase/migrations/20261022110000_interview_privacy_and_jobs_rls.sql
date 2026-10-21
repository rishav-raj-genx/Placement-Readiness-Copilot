-- Migration: 20261022110000_interview_privacy_and_jobs_rls.sql
-- Enforce strict interview session privacy per student_id and unblock discovered_jobs via hybrid RLS policy.

-- ====================================================================
-- PHASE 1: PRIVACY LOCKDOWN (interview_sessions RLS)
-- ====================================================================
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

-- Drop legacy or conflicting SELECT policies
DROP POLICY IF EXISTS "Students can only view their own interviews" ON public.interview_sessions;
DROP POLICY IF EXISTS "Students can read own interview sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "select_own_interview_sessions" ON public.interview_sessions;

-- Apply strict privacy lock: Students can only view their own interviews
CREATE POLICY "Students can only view their own interviews" 
ON public.interview_sessions FOR SELECT 
TO authenticated
USING (
  auth.uid() = student_id OR
  auth.uid()::text = student_id::text OR
  auth.uid() = user_id
);

-- ====================================================================
-- PHASE 2: JOB BOARD DATABASE UNBLOCKING (discovered_jobs RLS)
-- ====================================================================
-- Ensure RLS is enabled
ALTER TABLE public.discovered_jobs ENABLE ROW LEVEL SECURITY;

-- Drop any existing overly restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view their own matched jobs" ON public.discovered_jobs;
DROP POLICY IF EXISTS "Authenticated users can read discovered jobs" ON public.discovered_jobs;
DROP POLICY IF EXISTS "Students view personal matches and MSOT posts" ON public.discovered_jobs;

-- Create the correct hybrid policy
CREATE POLICY "Students view personal matches and MSOT posts" 
ON public.discovered_jobs FOR SELECT 
TO authenticated
USING (
  student_id = auth.uid() OR 
  student_id::text = auth.uid()::text OR
  is_msot_post = true
);

NOTIFY pgrst, 'reload schema';
