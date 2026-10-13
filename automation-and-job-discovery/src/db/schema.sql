-- ====================================================================
-- SUPABASE COMPLETE PRODUCTION SCHEMA FOR PLACEMENT READINESS COPILOT
-- Contains canonical tables, strict RLS policies, and uniqueness constraints
-- ====================================================================

-- 1. Canonical Interview Sessions Table (Module 3 - Voice & AI Viva)
-- Platform canonical source of interview results
CREATE TABLE IF NOT EXISTS interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    result JSONB NOT NULL,
    contract_version TEXT GENERATED ALWAYS AS (result->>'contract_version') STORED,
    interview_score NUMERIC(5, 2) GENERATED ALWAYS AS (COALESCE((result->>'interview_score')::numeric, 0.0)) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_student ON interview_sessions(student_id, created_at DESC);

-- Provisional table adapter
CREATE TABLE IF NOT EXISTS mock_interview_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    interview_score NUMERIC(5, 2) NOT NULL CHECK (interview_score >= 0.0 AND interview_score <= 100.0),
    technical_score NUMERIC(5, 2) DEFAULT 0.0,
    communication_score NUMERIC(5, 2) DEFAULT 0.0,
    behavioral_score NUMERIC(5, 2) DEFAULT 0.0,
    strengths JSONB DEFAULT '[]'::jsonb,
    weak_areas JSONB DEFAULT '[]'::jsonb,
    feedback_notes TEXT,
    transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
    mode TEXT DEFAULT 'hosted_api' CHECK (mode IN ('hosted_api', 'ollama_local')),
    duration_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_interview_student ON mock_interview_results(student_id);
CREATE INDEX IF NOT EXISTS idx_mock_interview_student_created ON mock_interview_results(student_id, created_at DESC);

-- View: Canonical or latest mock interview per student
CREATE OR REPLACE VIEW latest_student_mock_interviews AS
SELECT DISTINCT ON (student_id)
    id,
    student_id,
    interview_score,
    contract_version,
    result->>'summary' AS summary,
    result->'transcript' AS transcript,
    created_at
FROM interview_sessions
WHERE contract_version = 'v0'
ORDER BY student_id, created_at DESC;

-- 2. Live Link Check Results Table (Module 2)
CREATE TABLE IF NOT EXISTS project_live_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    project_name TEXT,
    project_url TEXT NOT NULL,
    status_code INTEGER,
    is_live BOOLEAN NOT NULL DEFAULT false,
    load_time_ms INTEGER,
    mobile_friendly BOOLEAN DEFAULT false,
    screenshot_url TEXT,
    console_errors JSONB DEFAULT '[]'::jsonb,
    network_errors JSONB DEFAULT '[]'::jsonb,
    content_evaluation JSONB DEFAULT '{}'::jsonb,
    quality_score NUMERIC(5, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_checks_student ON project_live_checks(student_id);
CREATE INDEX IF NOT EXISTS idx_live_checks_url ON project_live_checks(project_url);

-- 3. Discovered Jobs Table (Module 5 - Greenhouse, Lever & RSS)
CREATE TABLE IF NOT EXISTS discovered_jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    matched_skills JSONB DEFAULT '[]'::jsonb,
    relevance_score NUMERIC(5, 2) DEFAULT 0.0,
    match_reason TEXT,
    is_remote BOOLEAN DEFAULT false,
    job_type TEXT DEFAULT 'internship/entry-level',
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_relevance ON discovered_jobs(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON discovered_jobs(company);

-- 4. Application Tracker Table (Module 5 - Kanban Pipeline)
CREATE TABLE IF NOT EXISTS application_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    job_id TEXT REFERENCES discovered_jobs(id) ON DELETE SET NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'Saved' CHECK (status IN ('Saved', 'Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected')),
    applied_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, company, role)
);

CREATE INDEX IF NOT EXISTS idx_app_tracker_student ON application_tracker(student_id, status);

-- 5. Student Placement Readiness Scores Table (Module 4)
CREATE TABLE IF NOT EXISTS readiness_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL UNIQUE,
    total_score NUMERIC(5, 2) NOT NULL,
    readiness_level TEXT NOT NULL CHECK (readiness_level IN ('Not ready', 'Almost ready', 'Placement ready')),
    breakdown JSONB NOT NULL,
    top_actions JSONB NOT NULL,
    raw_inputs JSONB DEFAULT '{}'::jsonb,
    algorithm_version TEXT DEFAULT 'v1.0.0',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readiness_level ON readiness_scores(readiness_level);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Scoped to auth.uid() for students; full server-only access for service_role
-- ====================================================================

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_interview_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_live_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_jobs ENABLE ROW LEVEL SECURITY;

-- 1. Student Read-Own / Delete-Own Policies
CREATE POLICY "Students can read own interview sessions"
    ON interview_sessions FOR SELECT
    USING (auth.uid()::text = student_id);

CREATE POLICY "Students can delete own interview sessions"
    ON interview_sessions FOR DELETE
    USING (auth.uid()::text = student_id);

CREATE POLICY "Students can read own live checks"
    ON project_live_checks FOR SELECT
    USING (auth.uid()::text = student_id);

CREATE POLICY "Students can read own readiness scores"
    ON readiness_scores FOR SELECT
    USING (auth.uid()::text = student_id);

CREATE POLICY "Students can manage own applications"
    ON application_tracker FOR ALL
    USING (auth.uid()::text = student_id)
    WITH CHECK (auth.uid()::text = student_id);

CREATE POLICY "Authenticated users can read discovered jobs"
    ON discovered_jobs FOR SELECT
    TO authenticated
    USING (true);

-- 2. Server-Only Service Role Policies (Automation & Background Jobs)
CREATE POLICY "Service role full access interview_sessions"
    ON interview_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access mock_interview_results"
    ON mock_interview_results FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access project_live_checks"
    ON project_live_checks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access readiness_scores"
    ON readiness_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access discovered_jobs"
    ON discovered_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access application_tracker"
    ON application_tracker FOR ALL TO service_role USING (true) WITH CHECK (true);
