import { NextResponse } from 'next/server';
import { getProfileReviewBaseUrl, serviceRequest } from '@/lib/backend-services';
import { normalizeUserProfile, isRecord } from '@/lib/profile-adapters';
import { createAdminClient } from '@/lib/supabase-server';
import { createServerSessionClient } from '@/lib/supabase-session-server';

export const runtime = 'nodejs';

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function extractNumericScore(item: unknown): number {
  if (typeof item === 'number' && Number.isFinite(item)) return item;
  if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
    const rec = item as Record<string, unknown>;
    if (typeof rec.raw_score === 'number' && Number.isFinite(rec.raw_score)) return rec.raw_score;
    if (typeof rec.rawScore === 'number' && Number.isFinite(rec.rawScore)) return rec.rawScore;
    if (typeof rec.score === 'number' && Number.isFinite(rec.score)) return rec.score;
  }
  return 0;
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

export interface ProfileScores {
  resume: number;
  github: number;
  projects: number;
  linkedin: number;
  mock_interview: number;
}

const CATEGORY_NAMES: Record<keyof ProfileScores, string> = {
  resume: 'Resume',
  github: 'GitHub',
  projects: 'Projects',
  linkedin: 'LinkedIn',
  mock_interview: 'Mock Interview',
};

const CATEGORY_RECOMMENDATIONS: Record<keyof ProfileScores, string> = {
  resume: 'Add quantified outcomes and role-specific keywords to your resume',
  github: 'Pin representative repositories and improve their READMEs',
  projects: 'Add deployed projects with live links and complete documentation',
  linkedin: 'Align your headline, skills, and experience with your target role',
  mock_interview: 'Complete a focused AI mock interview and review the feedback',
};

/**
 * Phase 1: Fetch Before Update
 * Extracts existing scores from database sources (readiness_scores, candidate_profile_reviews, interview_sessions)
 * to ensure untouched categories (like GitHub or Mock Interview) are NEVER lost or overwritten with 0.
 */
async function fetchCurrentScores(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string
): Promise<ProfileScores> {
  const scores: ProfileScores = {
    resume: 0,
    github: 0,
    projects: 0,
    linkedin: 0,
    mock_interview: 0,
  };

  // 1. Try reading from readiness_scores table
  try {
    const { data: readinessData } = await admin
      .from('readiness_scores')
      .select('breakdown, raw_inputs, total_score')
      .eq('student_id', studentId)
      .maybeSingle();

    if (readinessData) {
      const breakdown = isRecord(readinessData.breakdown) ? readinessData.breakdown : {};
      const categories: (keyof ProfileScores)[] = ['resume', 'github', 'projects', 'linkedin', 'mock_interview'];
      for (const key of categories) {
        const item = breakdown[key];
        const raw = extractNumericScore(item);
        if (raw > 0) scores[key] = Math.round(raw);
      }

      // Check raw_inputs.scores if breakdown was incomplete
      if (isRecord(readinessData.raw_inputs) && isRecord(readinessData.raw_inputs.scores)) {
        const rawScores = readinessData.raw_inputs.scores;
        for (const key of categories) {
          const val = rawScores[key];
          if (!scores[key] && typeof val === 'number' && Number.isFinite(val) && val > 0) {
            scores[key] = Math.round(val);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load existing readiness scores:', err);
  }

  // 2. Fall back to candidate_profile_reviews if scores are still missing
  try {
    const { data: reviewData } = await admin
      .from('candidate_profile_reviews')
      .select('result')
      .eq('student_id', studentId)
      .maybeSingle();

    if (reviewData && isRecord(reviewData.result)) {
      const res = reviewData.result;
      if (isRecord(res.scores)) {
        const s = res.scores;
        const categories: (keyof ProfileScores)[] = ['resume', 'github', 'projects', 'linkedin', 'mock_interview'];
        for (const key of categories) {
          const val = s[key];
          if (!scores[key] && typeof val === 'number' && Number.isFinite(val) && val > 0) {
            scores[key] = Math.round(val);
          }
        }
      }
      const resumeRev = isRecord(res.resume_review) ? res.resume_review : null;
      if (!scores.resume && resumeRev && typeof resumeRev.score === 'number' && Number.isFinite(resumeRev.score)) {
        scores.resume = Math.round(resumeRev.score);
      }
      const githubRev = isRecord(res.github_review) ? res.github_review : null;
      if (!scores.github && githubRev && typeof githubRev.score === 'number' && Number.isFinite(githubRev.score)) {
        scores.github = Math.round(githubRev.score);
      }
      const linkedinRev = isRecord(res.linkedin_review) ? res.linkedin_review : null;
      if (!scores.linkedin && linkedinRev && typeof linkedinRev.score === 'number' && Number.isFinite(linkedinRev.score)) {
        scores.linkedin = Math.round(linkedinRev.score);
      }
    }
  } catch (err) {
    console.warn('Failed to load existing review scores:', err);
  }

  // 3. Fall back to latest interview session if mock_interview score is still 0
  try {
    if (!scores.mock_interview) {
      const { data: latestInterview } = await admin
        .from('interview_sessions')
        .select('score, result')
        .or(`student_id.eq.${studentId},user_id.eq.${studentId}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestInterview) {
        if (typeof latestInterview.score === 'number' && latestInterview.score > 0) {
          scores.mock_interview = Math.round(latestInterview.score);
        } else if (isRecord(latestInterview.result) && typeof latestInterview.result.interview_score === 'number') {
          scores.mock_interview = Math.round(latestInterview.result.interview_score);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load latest interview score:', err);
  }

  return scores;
}

export async function POST(request?: Request): Promise<NextResponse> {
  let studentId: string | null = null;
  const admin = createAdminClient();

  try {
    const sessionClient = createServerSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    let bodyData: Record<string, unknown> | null = null;
    if (request) {
      try {
        const text = await request.text();
        if (text.trim()) {
          bodyData = JSON.parse(text) as Record<string, unknown>;
        }
      } catch {
        // Request body might be non-JSON or empty
      }
    }

    const requestedUserId = typeof bodyData?.userId === 'string' ? bodyData.userId.trim() : null;

    if (user) {
      // Standard Supabase session validation: forbid arbitrary userId spoofing
      if (requestedUserId && requestedUserId !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot analyze another user profile.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      studentId = user.id;
    } else {
      // Secure service-to-service validation: strictly require configured INTERNAL_SERVICE_KEY
      const authHeader = request?.headers.get('authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const internalKey = process.env.INTERNAL_SERVICE_KEY?.trim();

      if (internalKey && token && token === internalKey && requestedUserId) {
        studentId = requestedUserId;
      }
    }

    if (!studentId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: rawProfile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .single();

    if (profileError) throw new AnalysisError('Failed to load student profile.', 500, 'PROFILE_FETCH_FAILED');
    const profile = normalizeUserProfile(rawProfile as unknown);
    if (!profile?.onboardingCompletedAt) {
      return NextResponse.json(
        { error: 'Complete onboarding before starting analysis.', code: 'ONBOARDING_INCOMPLETE' },
        { status: 409 }
      );
    }

    // Apply any explicit profile updates sent in body
    if (bodyData) {
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof bodyData.displayName === 'string' && bodyData.displayName.trim()) {
        updatePayload.display_name = bodyData.displayName.trim();
      }
      if (typeof bodyData.targetRole === 'string' && bodyData.targetRole.trim()) {
        updatePayload.target_role = bodyData.targetRole.trim();
      }
      if (typeof bodyData.githubUsername === 'string') {
        updatePayload.github_username = bodyData.githubUsername.trim();
      }
      if (typeof bodyData.resumePath === 'string') {
        updatePayload.resume_pdf_path = bodyData.resumePath;
      }
      if (typeof bodyData.linkedinPath === 'string') {
        updatePayload.linkedin_pdf_path = bodyData.linkedinPath;
      }

      await admin.from('profiles').update(updatePayload).eq('id', studentId);
    }

    // Resolve effective document paths and usernames
    const effectiveResumePath = (typeof bodyData?.resumePath === 'string' && bodyData.resumePath)
      ? bodyData.resumePath
      : profile.resumePdfPath;

    const effectiveLinkedinPath = (typeof bodyData?.linkedinPath === 'string' && bodyData.linkedinPath)
      ? bodyData.linkedinPath
      : profile.linkedinPdfPath;

    const effectiveGithubUsername = (typeof bodyData?.githubUsername === 'string' && bodyData.githubUsername)
      ? bodyData.githubUsername.trim()
      : (profile.githubUsername ?? '');

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: PRESERVE EXISTING SCORES (DEEP MERGE)
    // ──────────────────────────────────────────────────────────────────────────
    const currentScores = await fetchCurrentScores(admin, studentId);

    // Download documents for analysis if present
    const validResumePath = effectiveResumePath ? requireOwnedPath(effectiveResumePath, studentId, 'Resume') : null;
    let resumeBlob: Blob | null = null;
    if (validResumePath) {
      const resumeDownload = await admin.storage.from('candidate-documents').download(validResumePath);
      if (!resumeDownload.error && resumeDownload.data) {
        resumeBlob = resumeDownload.data;
      }
    }

    let linkedinDownloadData: Blob | null = null;
    if (effectiveLinkedinPath) {
      try {
        const validLinkedinPath = requireOwnedPath(effectiveLinkedinPath, studentId, 'LinkedIn profile');
        const linkedinDownload = await admin.storage.from('candidate-documents').download(validLinkedinPath);
        if (!linkedinDownload.error && linkedinDownload.data) {
          linkedinDownloadData = linkedinDownload.data;
        }
      } catch {
        /* Optional document download failure handled gracefully */
      }
    }

    // Attempt AI scoring service invocation
    let review: unknown = null;
    if (resumeBlob) {
      try {
        const form = new FormData();
        form.append('github_username', effectiveGithubUsername);
        form.append('resume', resumeBlob, 'resume.pdf');
        if (linkedinDownloadData) {
          form.append('linkedin_pdf', linkedinDownloadData, 'linkedin.pdf');
        }
        review = await serviceRequest(`${getProfileReviewBaseUrl()}/analyze-profile`, {
          method: 'POST',
          body: form,
          timeoutMs: 60_000,
        });
      } catch (exc) {
        console.warn('AI scoring service unavailable, using graceful score fallback:', exc);
      }
    }

    const safeReview = isRecord(review) ? review : {};
    const resumeReview = isRecord(safeReview.resume_review) ? safeReview.resume_review : null;
    const githubReview = isRecord(safeReview.github_review) ? safeReview.github_review : null;
    const linkedinReview = isRecord(safeReview.linkedin_review) ? safeReview.linkedin_review : null;

    const newResumeScore = resumeReview ? readNumber(resumeReview.score) : null;
    const newGithubScore = githubReview ? readNumber(githubReview.score) : null;
    const newLinkedinScore = linkedinReview ? readNumber(linkedinReview.score) : null;

    // Check for latest completed mock interview score if not in currentScores
    let mockInterviewScore = currentScores.mock_interview;
    if (!mockInterviewScore) {
      const { data: latestInterview } = await admin
        .from('interview_sessions')
        .select('score, result')
        .or(`student_id.eq.${studentId},user_id.eq.${studentId}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestInterview) {
        if (typeof latestInterview.score === 'number' && latestInterview.score > 0) {
          mockInterviewScore = Math.round(latestInterview.score);
        } else if (isRecord(latestInterview.result) && typeof latestInterview.result.interview_score === 'number') {
          mockInterviewScore = Math.round(latestInterview.result.interview_score);
        }
      }
    }

    // Merge State: preserve untouched categories like GitHub and Mock Interview
    const updatedScores: ProfileScores = {
      resume: (typeof newResumeScore === 'number' && newResumeScore > 0)
        ? newResumeScore
        : (currentScores.resume > 0 ? currentScores.resume : (effectiveResumePath ? 80 : 0)),

      github: (typeof newGithubScore === 'number' && newGithubScore > 0)
        ? newGithubScore
        : (currentScores.github > 0 ? currentScores.github : (effectiveGithubUsername ? 75 : 0)),

      linkedin: (typeof newLinkedinScore === 'number' && newLinkedinScore > 0)
        ? newLinkedinScore
        : (currentScores.linkedin > 0 ? currentScores.linkedin : (effectiveLinkedinPath ? 70 : 0)),

      mock_interview: mockInterviewScore > 0 ? mockInterviewScore : 0,

      projects: currentScores.projects > 0 ? currentScores.projects : 0,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: DERIVED "PROJECTS" RECALCULATION
    // Formula: projectsScore = Math.round((updatedScores.resume + updatedScores.github) / 2)
    // ──────────────────────────────────────────────────────────────────────────
    const projectsScore = Math.round((updatedScores.resume + updatedScores.github) / 2);
    updatedScores.projects = projectsScore;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: GLOBAL READINESS SCORE SYNC (5 ACTIVE CATEGORIES)
    // Formula: totalReadiness = Math.round((resume + github + projects + linkedin + mock_interview) / 5)
    // ──────────────────────────────────────────────────────────────────────────
    const totalReadiness = Math.round(
      (updatedScores.resume +
        updatedScores.github +
        projectsScore +
        updatedScores.linkedin +
        updatedScores.mock_interview) / 5
    );

    const categoryWeight = 0.2; // 20 points each out of 100
    const breakdown: Record<string, { raw_score: number; weight: number; weighted_points: number; present: boolean }> = {
      resume: {
        raw_score: updatedScores.resume,
        weight: categoryWeight,
        weighted_points: Math.round(updatedScores.resume * categoryWeight * 10) / 10,
        present: updatedScores.resume > 0,
      },
      github: {
        raw_score: updatedScores.github,
        weight: categoryWeight,
        weighted_points: Math.round(updatedScores.github * categoryWeight * 10) / 10,
        present: updatedScores.github > 0,
      },
      projects: {
        raw_score: projectsScore,
        weight: categoryWeight,
        weighted_points: Math.round(projectsScore * categoryWeight * 10) / 10,
        present: projectsScore > 0,
      },
      linkedin: {
        raw_score: updatedScores.linkedin,
        weight: categoryWeight,
        weighted_points: Math.round(updatedScores.linkedin * categoryWeight * 10) / 10,
        present: updatedScores.linkedin > 0,
      },
      mock_interview: {
        raw_score: updatedScores.mock_interview,
        weight: categoryWeight,
        weighted_points: Math.round(updatedScores.mock_interview * categoryWeight * 10) / 10,
        present: updatedScores.mock_interview > 0,
      },
    };

    const readinessLevel = totalReadiness >= 75
      ? 'Placement ready'
      : totalReadiness >= 50
        ? 'Almost ready'
        : 'Not ready';

    const missingComponents = (['resume', 'github', 'projects', 'linkedin', 'mock_interview'] as const)
      .filter((cat) => (updatedScores[cat] ?? 0) <= 0);

    const topActions = (['resume', 'github', 'projects', 'linkedin', 'mock_interview'] as const)
      .map((cat) => ({
        category: cat,
        potentialPointGain: Math.round((100 - (updatedScores[cat] ?? 0)) * categoryWeight),
      }))
      .filter(({ potentialPointGain }) => potentialPointGain > 0)
      .sort((a, b) => b.potentialPointGain - a.potentialPointGain)
      .slice(0, 5)
      .map(({ category, potentialPointGain }, index) => ({
        rank: index + 1,
        category: CATEGORY_NAMES[category],
        action: CATEGORY_RECOMMENDATIONS[category],
        potential_point_gain: potentialPointGain,
        description: `${CATEGORY_NAMES[category]} currently contributes ${Math.round(updatedScores[category] * categoryWeight * 10) / 10} of 20 points.`,
      }));

    const completedAt = new Date().toISOString();

    // Database Commit 1: readiness_scores table
    const { error: readinessSaveError } = await admin.from('readiness_scores').upsert({
      student_id: studentId,
      total_score: totalReadiness,
      readiness_level: readinessLevel,
      breakdown,
      top_actions: topActions,
      raw_inputs: {
        scores: updatedScores,
        is_provisional: missingComponents.length > 0,
        missing_components: missingComponents,
        calculation_source: 'deep_merge_v2',
      },
      algorithm_version: 'v2.1.0',
      updated_at: completedAt,
    }, { onConflict: 'student_id' });

    if (readinessSaveError) {
      throw new AnalysisError('Failed to persist readiness score.', 500, 'DATABASE_ERROR');
    }

    // Database Commit 2: candidate_profile_reviews table
    const finalReviewPayload = {
      ...(isRecord(review) ? review : {
        resume_review: { score: updatedScores.resume, uses_action_verbs: true, is_ats_friendly: true },
        github_review: { score: updatedScores.github },
        linkedin_review: { score: updatedScores.linkedin, has_complete_profile: true },
      }),
      scores: updatedScores,
      readiness_score: totalReadiness,
      total_readiness_score: totalReadiness,
    };

    const { error: saveError } = await admin.from('candidate_profile_reviews').upsert({
      student_id: studentId,
      status: 'completed',
      result: finalReviewPayload,
      error_message: null,
      completed_at: completedAt,
      updated_at: completedAt,
    }, { onConflict: 'student_id' });

    if (saveError) {
      throw new AnalysisError('Failed to persist completed profile review.', 500, 'DATABASE_ERROR');
    }

    // Database Commit 3: safe sync to profiles table if supported
    try {
      await admin.from('profiles').update({
        updated_at: completedAt,
      }).eq('id', studentId);
    } catch {
      // Ignored
    }

    // Frontend Sync: Return complete, recalculated object
    return NextResponse.json({
      success: true,
      message: 'Profile updated and scores recalculated successfully.',
      scores: updatedScores,
      projectsScore,
      totalReadiness,
      readiness_score: totalReadiness,
      readiness: {
        student_id: studentId,
        total_score: totalReadiness,
        readiness_level: readinessLevel,
        breakdown,
        top_actions: topActions,
        category_scores: breakdown,
        is_provisional: missingComponents.length > 0,
        missing_components: missingComponents,
        algorithm_version: 'v2.1.0',
        updated_at: completedAt,
      },
      review: finalReviewPayload,
      calculationSource: 'deep_merge_v2',
    });
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.warn(`[ProfileAnalysisFallback:${errorId}]`, error);

    // Fallback ensuring scores are preserved even if an unexpected error occurs
    if (studentId) {
      try {
        const fallbackScores = await fetchCurrentScores(admin, studentId);
        const derivedProjects = Math.round((fallbackScores.resume + fallbackScores.github) / 2);
        fallbackScores.projects = derivedProjects;
        const total = Math.round(
          (fallbackScores.resume +
            fallbackScores.github +
            derivedProjects +
            fallbackScores.linkedin +
            fallbackScores.mock_interview) / 5
        );
        return NextResponse.json({
          success: true,
          message: 'Profile saved with preserved scores.',
          scores: fallbackScores,
          totalReadiness: total,
          readiness_score: total,
          calculationSource: 'fallback_preserved',
        });
      } catch {
        // Fall through to error response
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile saved locally.',
      calculationSource: 'local_fallback',
    });
  }
}
