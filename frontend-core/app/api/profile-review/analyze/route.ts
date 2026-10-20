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

function requireOwnedPath(path: string | undefined, userId: string, label: string): string {
  if (!path || !path.startsWith(`${userId}/`)) throw new Error(`${label} is missing or does not belong to this user.`);
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

export async function POST(): Promise<NextResponse> {
  let studentId: string | null = null;
  try {
    const sessionClient = createServerSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    studentId = user.id;
    const admin = createAdminClient();
    const { data: rawProfile, error: profileError } = await admin.from('profiles').select('*').eq('id', studentId).single();
    if (profileError) throw profileError;
    const profile = normalizeUserProfile(rawProfile as unknown);
    if (!profile?.onboardingCompletedAt) return NextResponse.json({ error: 'Complete onboarding before starting analysis.' }, { status: 409 });

    await admin.from('candidate_profile_reviews').upsert({ student_id: studentId, status: 'processing', result: null, error_message: null, started_at: new Date().toISOString(), completed_at: null }, { onConflict: 'student_id' });

    const resumePath = requireOwnedPath(profile.resumePdfPath, studentId, 'Resume');
    const resumeDownload = await admin.storage.from('candidate-documents').download(resumePath);
    if (resumeDownload.error || !resumeDownload.data) throw resumeDownload.error ?? new Error('Unable to download the resume.');

    let linkedinDownloadData: Blob | null = null;
    if (profile.linkedinPdfPath && profile.linkedinPdfPath.startsWith(`${studentId}/`)) {
      const { data: dlData } = await admin.storage.from('candidate-documents').download(profile.linkedinPdfPath);
      if (dlData) linkedinDownloadData = dlData;
    }

    const form = new FormData();
    form.append('github_username', profile.githubUsername ?? '');
    form.append('resume', resumeDownload.data, 'resume.pdf');
    if (linkedinDownloadData) {
      form.append('linkedin_pdf', linkedinDownloadData, 'linkedin.pdf');
    }
    const review = await serviceRequest(`${getProfileReviewBaseUrl()}/analyze-profile`, { method: 'POST', body: form, timeoutMs: 60_000 });
    if (!isRecord(review)) throw new Error('Profile review returned an invalid response.');

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
      .select('result, is_provisional')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Issue 15: Explicitly track provisional interview results so they don't masquerade as final
    let interviewPayload = latestInterview?.result ? { ...(latestInterview.result as Record<string, unknown>) } : null;
    if (interviewPayload && (latestInterview?.is_provisional === true || interviewPayload.is_provisional === true)) {
      interviewPayload.is_provisional = true;
    }

    const resumeReview = isRecord(review.resume_review) ? review.resume_review : null;
    const githubReview = isRecord(review.github_review) ? review.github_review : null;
    const linkedinReview = isRecord(review.linkedin_review) ? review.linkedin_review : null;
    const readinessInput: ReadinessCalculationInput = {
      student_id: studentId, student_name: profile.displayName,
      resume: resumeReview ? { score: readNumber(resumeReview.score), page_count: readNumber(resumeReview.page_count), has_action_verbs: resumeReview.uses_action_verbs === true, has_clean_formatting: resumeReview.is_ats_friendly === true, missing_elements: Array.isArray(resumeReview.specific_fixes) ? resumeReview.specific_fixes : [] } : null,
      projects: readinessProjects,
      interview_session_result: interviewPayload as any,
      github: githubReview ? { score: readNumber(githubReview.score) } : null,
      coding_practice: null,
      linkedin: linkedinReview ? { score: readNumber(linkedinReview.score), has_about_summary: linkedinReview.has_complete_profile === true, has_headline: linkedinReview.has_complete_profile === true } : null,
      co_curricular: profile.coCurricular ? { score: scoreCoCurricular(profile.coCurricular), hackathons_count: profile.coCurricular.hackathonsCount, certifications_count: profile.coCurricular.certificationsCount, club_leadership: profile.coCurricular.clubLeadership } : null,
    };
    const readinessResult = await calculateReadiness(readinessInput, automationBaseUrl);
    const readiness = readinessResult.payload;
    if (!isRecord(readiness)) throw new Error('Readiness service returned an invalid response.');
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
      algorithm_version: typeof readiness.algorithm_version === 'string' ? readiness.algorithm_version : 'v2.0.0',
      updated_at: completedAt,
    }, { onConflict: 'student_id' });
    if (readinessSaveError) throw readinessSaveError;
    const { error: saveError } = await admin.from('candidate_profile_reviews').upsert({ student_id: studentId, status: 'completed', result: review, error_message: null, completed_at: completedAt, updated_at: completedAt }, { onConflict: 'student_id' });
    if (saveError) throw saveError;
    return NextResponse.json({ review, readiness, calculationSource: readinessResult.source });
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error(`[ProfileAnalysisError:${errorId}]`, error);
    const safeMessage = 'Profile analysis encountered an issue. Please review your uploads and try again.';
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
      } catch { /* Preserve the original service failure. */ }
    }
    return NextResponse.json({ error: safeMessage, errorId }, { status: 502 });
  }
}
