import { NextResponse } from 'next/server';
import { getOptionalAutomationBaseUrl, getProfileReviewBaseUrl, serviceRequest } from '@/lib/backend-services';
import { normalizeUserProfile, isRecord } from '@/lib/profile-adapters';
import { calculateReadinessLocally, type ReadinessCalculationInput } from '@/lib/readiness-calculator';
import { scoreCoCurricular } from '@/lib/scoring';
import { createAdminClient } from '@/lib/supabase-server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import type { CandidateProject } from '@/types';

export const runtime = 'nodejs';

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

class AnalysisError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

function requireOwnedPath(path: string | undefined, userId: string, label: string): string {
  if (!path) throw new AnalysisError(`${label} is missing or not provided.`, 400, 'MISSING_PATH');
  if (!path.startsWith(`${userId}/`)) {
    throw new AnalysisError(`${label} path does not belong to the authenticated user.`, 403, 'FORBIDDEN_PATH_TAMPERING');
  }
  return path;
}

async function checkProject(project: CandidateProject, studentId: string, skills: string[], automationBaseUrl: string | null): Promise<unknown> {
  if (!project.liveUrl || !automationBaseUrl) return null;
  try {
    return await serviceRequest(`${automationBaseUrl}/api/link-check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: project.liveUrl, student_id: studentId, project_name: project.name, claimed_keywords: skills }),
      timeoutMs: 30_000,
    });
  } catch {
    return null;
  }
}

async function calculateReadiness(
  input: ReadinessCalculationInput,
  automationBaseUrl: string | null,
): Promise<{ payload: unknown; source: 'automation' | 'local_fallback' }> {
  if (!automationBaseUrl) {
    return { payload: calculateReadinessLocally(input), source: 'local_fallback' };
  }
  try {
    const payload = await serviceRequest(`${automationBaseUrl}/api/calculate-readiness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      timeoutMs: 45_000,
    });
    return { payload, source: 'automation' };
  } catch {
    return { payload: calculateReadinessLocally(input), source: 'local_fallback' };
  }
}

export async function POST(request?: Request): Promise<NextResponse> {
  let studentId: string | null = null;
  try {
    const sessionClient = createServerSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    studentId = user.id;
    const admin = createAdminClient();
    const { data: rawProfile, error: profileError } = await admin.from('profiles').select('*').eq('id', studentId).single();
    if (profileError) throw new AnalysisError('Failed to load student profile.', 500, 'PROFILE_FETCH_FAILED');
    const profile = normalizeUserProfile(rawProfile as unknown);
    if (!profile?.onboardingCompletedAt) {
      return NextResponse.json({ error: 'Complete onboarding before starting analysis.', code: 'ONBOARDING_INCOMPLETE' }, { status: 409 });
    }

    // Idempotency and concurrency lock: prevent racing concurrent analysis runs
    const { data: existingReview } = await admin
      .from('candidate_profile_reviews')
      .select('status, started_at')
      .eq('student_id', studentId)
      .maybeSingle();

    if (existingReview?.status === 'processing' && existingReview.started_at) {
      const startedAt = new Date(existingReview.started_at).getTime();
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < 120_000) {
        return NextResponse.json({
          error: 'A profile review is already currently being processed for this account. Please wait for it to complete.',
          code: 'ANALYSIS_IN_PROGRESS',
        }, { status: 409 });
      }
    }

    // Status transition: check result of write
    const { error: initialStatusError } = await admin.from('candidate_profile_reviews').upsert({
      student_id: studentId,
      status: 'processing',
      result: null,
      error_message: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id' });
    if (initialStatusError) {
      throw new AnalysisError('Failed to initialize analysis job status.', 500, 'DATABASE_ERROR');
    }

    const resumePath = requireOwnedPath(profile.resumePdfPath, studentId, 'Resume');
    const resumeDownload = await admin.storage.from('candidate-documents').download(resumePath);
    if (resumeDownload.error || !resumeDownload.data) {
      throw new AnalysisError('Unable to download your resume from document storage. Please re-upload your resume.', 422, 'RESUME_DOWNLOAD_FAILED');
    }

    let linkedinDownloadData: Blob | null = null;
    if (profile.linkedinPdfPath) {
      const linkedinPath = requireOwnedPath(profile.linkedinPdfPath, studentId, 'LinkedIn profile');
      const linkedinDownload = await admin.storage.from('candidate-documents').download(linkedinPath);
      if (linkedinDownload.error || !linkedinDownload.data) {
        throw new AnalysisError('Uploaded LinkedIn document could not be retrieved from storage. Please re-upload.', 422, 'LINKEDIN_DOWNLOAD_FAILED');
      }
      linkedinDownloadData = linkedinDownload.data;
    }

    const form = new FormData();
    form.append('github_username', profile.githubUsername ?? '');
    form.append('resume', resumeDownload.data, 'resume.pdf');
    if (linkedinDownloadData) {
      form.append('linkedin_pdf', linkedinDownloadData, 'linkedin.pdf');
    }

    let review: unknown;
    try {
      review = await serviceRequest(`${getProfileReviewBaseUrl()}/analyze-profile`, { method: 'POST', body: form, timeoutMs: 60_000 });
    } catch (exc) {
      throw new AnalysisError(`Profile review API unavailable: ${exc instanceof Error ? exc.message : 'Unknown error'}`, 502, 'PROFILE_REVIEW_UNAVAILABLE');
    }
    if (!isRecord(review)) throw new AnalysisError('Profile review returned an invalid response structure.', 502, 'INVALID_PROFILE_REVIEW_RESPONSE');

    const automationBaseUrl = getOptionalAutomationBaseUrl();
    const projectChecks = await Promise.all(profile.projects.map((project) => checkProject(project, studentId as string, profile.skills, automationBaseUrl)));
    const readinessProjects = profile.projects.map((project, index) => {
      const check = projectChecks[index];
      const checked = isRecord(check) ? check : null;
      const isLive = checked?.is_live === true;
      const liveLinkScore = checked && isLive ? readNumber(checked.quality_score) : 0;
      const codeQualityScore = checked && typeof checked.code_quality_score === 'number'
        ? readNumber(checked.code_quality_score)
        : 0;
      const documentationScore = checked && typeof checked.documentation_score === 'number'
        ? readNumber(checked.documentation_score)
        : 0;
      const hasReadme = checked ? checked.has_readme === true : false;

      return {
        name: project.name,
        live_url: project.liveUrl ?? null,
        repo_url: project.repositoryUrl,
        live_link_score: liveLinkScore,
        code_quality_score: codeQualityScore,
        documentation_score: documentationScore,
        has_readme: hasReadme,
        is_live: isLive,
      };
    });

    const { data: latestInterview } = await admin
      .from('interview_sessions')
      .select('result')
      .or(`student_id.eq.${studentId},user_id.eq.${studentId}`)
      .eq('status', 'completed')
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Explicit contract validation: ensure is_provisional and is_fallback exist at root
    let interviewPayload: Record<string, unknown> | null = null;
    if (latestInterview?.result && typeof latestInterview.result === 'object') {
      interviewPayload = { ...(latestInterview.result as Record<string, unknown>) };
      if (!interviewPayload.contract_version) {
        interviewPayload.contract_version = 'v0';
      }
      interviewPayload.is_provisional = interviewPayload.is_provisional === true;
      interviewPayload.is_fallback = interviewPayload.is_fallback === true;
    }

    // Coding practice acquisition: support profile-provided practice stats or completed coding IDE sessions
    const rawCoding = isRecord((rawProfile as Record<string, unknown>).coding_practice)
      ? ((rawProfile as Record<string, unknown>).coding_practice as Record<string, unknown>)
      : null;
    let codingPracticeInput = rawCoding && typeof rawCoding.score === 'number' ? {
      score: readNumber(rawCoding.score),
      problems_solved: readNumber(rawCoding.problems_solved),
      easy_count: readNumber(rawCoding.easy_count),
      medium_count: readNumber(rawCoding.medium_count),
      hard_count: readNumber(rawCoding.hard_count),
    } : null;

    if (!codingPracticeInput) {
      const { data: latestCodingSession } = await admin
        .from('interview_sessions')
        .select('score, result')
        .or(`student_id.eq.${studentId},user_id.eq.${studentId}`)
        .eq('status', 'completed')
        .filter('config->>type', 'eq', 'coding')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestCodingSession && typeof latestCodingSession.score === 'number') {
        codingPracticeInput = {
          score: readNumber(latestCodingSession.score),
          problems_solved: 1,
          easy_count: 0,
          medium_count: 1,
          hard_count: 0,
        };
      }
    }

    const resumeReview = isRecord(review.resume_review) ? review.resume_review : null;
    const githubReview = isRecord(review.github_review) ? review.github_review : null;
    const linkedinReview = isRecord(review.linkedin_review) ? review.linkedin_review : null;
    const readinessInput: ReadinessCalculationInput = {
      student_id: studentId,
      student_name: profile.displayName,
      resume: resumeReview ? { score: readNumber(resumeReview.score), page_count: readNumber(resumeReview.page_count), has_action_verbs: resumeReview.uses_action_verbs === true, has_clean_formatting: resumeReview.is_ats_friendly === true, missing_elements: Array.isArray(resumeReview.specific_fixes) ? resumeReview.specific_fixes : [] } : null,
      projects: readinessProjects,
      interview_session_result: interviewPayload as any,
      github: githubReview ? { score: readNumber(githubReview.score) } : null,
      coding_practice: codingPracticeInput,
      linkedin: linkedinReview ? { score: readNumber(linkedinReview.score), has_about_summary: linkedinReview.has_complete_profile === true, has_headline: linkedinReview.has_complete_profile === true } : null,
      co_curricular: profile.coCurricular ? { score: scoreCoCurricular(profile.coCurricular), hackathons_count: profile.coCurricular.hackathonsCount, certifications_count: profile.coCurricular.certificationsCount, club_leadership: profile.coCurricular.clubLeadership } : null,
    };
    const readinessResult = await calculateReadiness(readinessInput, automationBaseUrl);
    const readiness = readinessResult.payload;
    if (!isRecord(readiness)) throw new AnalysisError('Readiness service returned an invalid response.', 502, 'INVALID_READINESS_RESPONSE');
    const completedAt = new Date().toISOString();
    const { error: readinessSaveError } = await admin.from('readiness_scores').upsert({
      student_id: studentId,
      total_score: readNumber(readiness.total_score),
      readiness_level: typeof readiness.readiness_level === 'string' ? readiness.readiness_level : 'Not ready',
      breakdown: isRecord(readiness.category_scores) ? readiness.category_scores : {},
      top_actions: Array.isArray(readiness.top_actions) ? readiness.top_actions : [],
      raw_inputs: {
        is_provisional: readiness.is_provisional === true,
        missing_components: Array.isArray(readiness.missing_components) ? readiness.missing_components : [],
        calculation_source: readinessResult.source,
      },
      algorithm_version: typeof readiness.algorithm_version === 'string' ? readiness.algorithm_version : 'v2.1.0',
      updated_at: completedAt,
    }, { onConflict: 'student_id' });
    if (readinessSaveError) throw new AnalysisError('Failed to persist readiness score.', 500, 'DATABASE_ERROR');
    const { error: saveError } = await admin.from('candidate_profile_reviews').upsert({ student_id: studentId, status: 'completed', result: review, error_message: null, completed_at: completedAt, updated_at: completedAt }, { onConflict: 'student_id' });
    if (saveError) throw new AnalysisError('Failed to persist completed profile review.', 500, 'DATABASE_ERROR');
    return NextResponse.json({ review, readiness, calculationSource: readinessResult.source });
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error(`[ProfileAnalysisError:${errorId}]`, error);
    if (studentId) {
      try {
        const admin = createAdminClient();
        await admin.from('candidate_profile_reviews').upsert({
          student_id: studentId,
          status: 'failed',
          error_message: `Analysis error (Ref: ${errorId})`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_id' });
      } catch { /* Preserve original service failure */ }
    }
    if (error instanceof AnalysisError) {
      return NextResponse.json({ error: error.message, code: error.code, errorId }, { status: error.status });
    }
    return NextResponse.json({
      error: 'Profile analysis encountered an unexpected issue. Please review your uploads and try again.',
      code: 'UNEXPECTED_ERROR',
      errorId,
    }, { status: 500 });
  }
}
