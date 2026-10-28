-- ====================================================================
-- SUPABASE COMPLETE UNIFIED PRODUCTION SCHEMA
-- Placement Readiness Copilot Platform
-- Idempotent script: Safe to run on fresh or existing database
-- ====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE (Core Candidate Profiles & Credentials)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  target_role text DEFAULT 'Software Engineer',
  target_locations text[] NOT NULL DEFAULT '{"India", "Remote"}',
  skills text[] NOT NULL DEFAULT '{}',
  projects jsonb NOT NULL DEFAULT '[]'::jsonb,
  co_curricular jsonb,
  github_username text,
  github_handle text,
  leetcode_url text,
  coding_profile_url text,
  linkedin_url text,
  linkedin_text text,
  resume_path text,
  resume_pdf_path text,
  linkedin_path text,
  linkedin_pdf_path text,
  scores jsonb DEFAULT '{}'::jsonb,
  interview_credits integer DEFAULT 3,
  is_premium boolean DEFAULT false,
  onboarding_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure all columns exist for existing deployments
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'Software Engineer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_locations TEXT[] NOT NULL DEFAULT '{"India", "Remote"}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS co_curricular JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_handle TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leetcode_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coding_profile_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_text TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_path TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_pdf_path TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_path TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_pdf_path TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interview_credits INTEGER DEFAULT 3;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Indices for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_leetcode_url ON public.profiles(leetcode_url) WHERE leetcode_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_github_username ON public.profiles(github_username) WHERE github_username IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────
-- 2. CANDIDATE PROFILE REVIEWS (AI Analysis, ATS & LeetCode/GitHub)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.candidate_profile_reviews (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_profile_reviews_status ON public.candidate_profile_reviews(status, updated_at DESC);

-- ────────────────────────────────────────────────────────────────────
-- 3. READINESS SCORES (Module 4 Composite Scoring Engine)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE,
  total_score numeric(5, 2) NOT NULL,
  readiness_level text NOT NULL CHECK (readiness_level IN ('Not ready', 'Almost ready', 'Placement ready')),
  breakdown jsonb NOT NULL,
  top_actions jsonb NOT NULL,
  raw_inputs jsonb DEFAULT '{}'::jsonb,
  algorithm_version text DEFAULT 'v1.0.0',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_student ON public.readiness_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_readiness_level ON public.readiness_scores(readiness_level);

-- ────────────────────────────────────────────────────────────────────
-- 4. INTERVIEW SESSIONS (LiveKit Voice Mock Interviews)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id text,
  livekit_room_name text NOT NULL,
  target_role text NOT NULL,
  job_id text,
  resume_id text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  room_metadata jsonb,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'active', 'in_progress', 'completed', 'abandoned', 'cancelled', 'error')),
  score numeric(5, 2),
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2);
ALTER TABLE public.interview_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user ON public.interview_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_student ON public.interview_sessions(student_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────
-- 5. MOCK INTERVIEW RESULTS (Provisional / Legacy Compatibility Table)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_interview_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  interview_score numeric(5, 2) NOT NULL CHECK (interview_score >= 0.0 AND interview_score <= 100.0),
  technical_score numeric(5, 2) DEFAULT 0.0,
  communication_score numeric(5, 2) DEFAULT 0.0,
  behavioral_score numeric(5, 2) DEFAULT 0.0,
  strengths jsonb DEFAULT '[]'::jsonb,
  weak_areas jsonb DEFAULT '[]'::jsonb,
  feedback_notes text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  mode text DEFAULT 'hosted_api' CHECK (mode IN ('hosted_api', 'ollama_local')),
  duration_minutes integer DEFAULT 30,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mock_interview_student ON public.mock_interview_results(student_id);
CREATE INDEX IF NOT EXISTS idx_mock_interview_student_created ON public.mock_interview_results(student_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────
-- 6. PROJECT LIVE CHECKS (Playwright Live Verification & Diagnostics)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_live_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  project_name text,
  project_url text NOT NULL,
  status_code integer,
  is_live boolean NOT NULL DEFAULT false,
  load_time_ms integer,
  mobile_friendly boolean DEFAULT false,
  screenshot_url text,
  console_errors jsonb DEFAULT '[]'::jsonb,
  network_errors jsonb DEFAULT '[]'::jsonb,
  content_evaluation jsonb DEFAULT '{}'::jsonb,
  quality_score numeric(5, 2) DEFAULT 0.0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_checks_student ON public.project_live_checks(student_id);
CREATE INDEX IF NOT EXISTS idx_live_checks_url ON public.project_live_checks(project_url);

-- ────────────────────────────────────────────────────────────────────
-- 7. DISCOVERED JOBS (JSearch API + Compliant Aggregation Cache)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discovered_jobs (
  id text PRIMARY KEY,
  student_id text,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  url text NOT NULL UNIQUE,
  source text NOT NULL,
  description text,
  required_skills jsonb DEFAULT '[]'::jsonb,
  matched_skills jsonb DEFAULT '[]'::jsonb,
  relevance_score numeric(5, 2) DEFAULT 0.0,
  match_reason text,
  is_remote boolean DEFAULT false,
  job_type text DEFAULT 'internship/entry-level',
  employment_type text DEFAULT 'full_time',
  publication_status text DEFAULT 'published',
  boolean_matched boolean DEFAULT false,
  is_msot_post boolean DEFAULT false,
  posted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS required_skills JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS matched_skills JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS relevance_score NUMERIC(5, 2) DEFAULT 0.0;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS match_reason TEXT;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT false;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'internship/entry-level';
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time';
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS publication_status TEXT DEFAULT 'published';
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS boolean_matched BOOLEAN DEFAULT false;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS is_msot_post BOOLEAN DEFAULT false;
ALTER TABLE public.discovered_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_jobs_student_created ON public.discovered_jobs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_relevance ON public.discovered_jobs(relevance_score DESC);

-- ────────────────────────────────────────────────────────────────────
-- 8. APPLICATION TRACKER (Kanban Job Application Board)
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.application_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  job_id text REFERENCES public.discovered_jobs(id) ON DELETE SET NULL,
  company text NOT NULL,
  role text NOT NULL,
  url text,
  status text NOT NULL DEFAULT 'Saved' CHECK (status IN ('Saved', 'Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected')),
  applied_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, company, role)
);

CREATE INDEX IF NOT EXISTS idx_app_tracker_student ON public.application_tracker(student_id, status);

-- ────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) & SERVICE ROLE POLICIES
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profile_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_interview_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_live_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_tracker ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "service_role_manage_profiles" ON public.profiles;
CREATE POLICY "service_role_manage_profiles" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Candidate Profile Reviews Policies
DROP POLICY IF EXISTS "Students can read own profile review" ON public.candidate_profile_reviews;
CREATE POLICY "Students can read own profile review" ON public.candidate_profile_reviews FOR SELECT TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Service role manages profile reviews" ON public.candidate_profile_reviews;
CREATE POLICY "Service role manages profile reviews" ON public.candidate_profile_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Readiness Scores Policies
DROP POLICY IF EXISTS "Students can read own readiness scores" ON public.readiness_scores;
CREATE POLICY "Students can read own readiness scores" ON public.readiness_scores FOR SELECT TO authenticated USING (auth.uid()::text = student_id);

DROP POLICY IF EXISTS "Service role full access readiness_scores" ON public.readiness_scores;
CREATE POLICY "Service role full access readiness_scores" ON public.readiness_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Interview Sessions Policies
DROP POLICY IF EXISTS "select_own_interview_sessions" ON public.interview_sessions;
CREATE POLICY "select_own_interview_sessions" ON public.interview_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid()::text = student_id);

DROP POLICY IF EXISTS "insert_own_interview_sessions" ON public.interview_sessions;
CREATE POLICY "insert_own_interview_sessions" ON public.interview_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_interview_sessions" ON public.interview_sessions;
CREATE POLICY "update_own_interview_sessions" ON public.interview_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access interview_sessions" ON public.interview_sessions;
CREATE POLICY "Service role full access interview_sessions" ON public.interview_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Mock Interview Results Policies
DROP POLICY IF EXISTS "Service role full access mock_interview_results" ON public.mock_interview_results;
CREATE POLICY "Service role full access mock_interview_results" ON public.mock_interview_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Project Live Checks Policies
DROP POLICY IF EXISTS "Students can read own live checks" ON public.project_live_checks;
CREATE POLICY "Students can read own live checks" ON public.project_live_checks FOR SELECT TO authenticated USING (auth.uid()::text = student_id);

DROP POLICY IF EXISTS "Service role full access project_live_checks" ON public.project_live_checks;
CREATE POLICY "Service role full access project_live_checks" ON public.project_live_checks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Discovered Jobs Policies
DROP POLICY IF EXISTS "Authenticated users can read discovered jobs" ON public.discovered_jobs;
CREATE POLICY "Authenticated users can read discovered jobs" ON public.discovered_jobs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role full access discovered_jobs" ON public.discovered_jobs;
CREATE POLICY "Service role full access discovered_jobs" ON public.discovered_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Application Tracker Policies
DROP POLICY IF EXISTS "Students can manage own applications" ON public.application_tracker;
CREATE POLICY "Students can manage own applications" ON public.application_tracker FOR ALL TO authenticated USING (auth.uid()::text = student_id) WITH CHECK (auth.uid()::text = student_id);

DROP POLICY IF EXISTS "Service role full access application_tracker" ON public.application_tracker;
CREATE POLICY "Service role full access application_tracker" ON public.application_tracker FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

