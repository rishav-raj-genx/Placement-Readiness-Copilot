import { NextResponse } from 'next/server';
import { getProfileReviewBaseUrl, serviceRequest } from '@/lib/backend-services';
import { normalizeUserProfile, isRecord } from '@/lib/profile-adapters';
import { createAdminClient } from '@/lib/supabase-server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import {
  normalizeLeetCodeStats,
  type LeetCodeStats,
} from '@/lib/leetcode';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

function normalizeDocumentPath(rawPath: string | undefined, userId: string): string | null {
  if (!rawPath) return null;
  let cleaned = rawPath.trim();
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const url = new URL(cleaned);
      const parts = url.pathname.split('candidate-documents/');
      if (parts.length > 1) {
        cleaned = decodeURIComponent(parts[1]);
      } else {
        const segs = url.pathname.split('/').filter(Boolean);
        const userIdx = segs.indexOf(userId);
        if (userIdx !== -1) {
          cleaned = segs.slice(userIdx).join('/');
        }
      }
    } catch {
      // Keep as-is if URL parsing fails
    }
  }
  cleaned = cleaned.split('?')[0].split('#')[0];
  cleaned = cleaned.replace(/^\/+/, '');
  if (cleaned.startsWith('candidate-documents/')) {
    cleaned = cleaned.replace(/^candidate-documents\//, '');
  }
  return cleaned;
}

function requireOwnedPath(path: string | undefined, userId: string, label: string): string {
  if (!path) throw new AnalysisError(`${label} is missing or not provided.`, 400, 'MISSING_PATH');
  const normalized = normalizeDocumentPath(path, userId);
  if (!normalized || !normalized.startsWith(`${userId}/`)) {
    throw new AnalysisError(`${label} path does not belong to the authenticated user.`, 403, 'FORBIDDEN_PATH_TAMPERING');
  }
  return normalized;
}

export interface ProfileScores {
  resume: number;
  projects: number;
  mock_interview: number;
  github: number;
  linkedin: number;
  leetcode: number;
  coding_practice: number;
  co_curricular?: number;
}

const CATEGORY_NAMES: Record<keyof ProfileScores, string> = {
  resume: 'Resume',
  projects: 'Projects',
  mock_interview: 'Mock Interview',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  leetcode: 'LeetCode',
  coding_practice: 'LeetCode & Coding',
  co_curricular: 'Co-curricular',
};

const CATEGORY_RECOMMENDATIONS: Record<keyof ProfileScores, string> = {
  resume: 'Add quantified outcomes and role-specific keywords to your resume',
  projects: 'Add deployed projects with live links and complete documentation',
  mock_interview: 'Complete a focused AI mock interview and review the feedback',
  github: 'Pin representative repositories and improve their READMEs',
  linkedin: 'Align your headline, skills, and experience with your target role',
  leetcode: 'Solve more problems on LeetCode with strong Medium/Hard ratio',
  coding_practice: 'Solve more problems on LeetCode with strong Medium/Hard ratio',
  co_curricular: 'Add verified certifications, hackathons, or leadership achievements',
};

const CATEGORY_WEIGHTS: Record<keyof ProfileScores, number> = {
  resume: 0.25,
  projects: 0.25,
  mock_interview: 0.20,
  github: 0.10,
  coding_practice: 0.10,
  leetcode: 0.10,
  linkedin: 0.05,
  co_curricular: 0.05,
};

const CATEGORY_MAX_POINTS: Record<keyof ProfileScores, number> = {
  resume: 25,
  projects: 25,
  mock_interview: 20,
  github: 10,
  coding_practice: 10,
  leetcode: 10,
  linkedin: 5,
  co_curricular: 5,
};

async function computeProjectsScore(
  projects: Array<{
    id?: string;
    title?: string;
    name?: string;
    description?: string;
    repoUrl?: string;
    repositoryUrl?: string;
    githubUrl?: string;
    liveUrl?: string;
  }> | undefined,
  studentId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<number> {
  if (!projects || projects.length === 0) {
    return 0;
  }

  let score = 0;
  const count = projects.length;

  // 1. Portfolio depth (up to 30 points)
  if (count >= 3) score += 30;
  else if (count === 2) score += 20;
  else score += 12;

  // 2. Project completeness: repositories, live links, and descriptions (up to 35 points)
  let detailPoints = 0;
  for (const p of projects) {
    let pScore = 0;
    if (p.description && p.description.trim().length >= 30) pScore += 12;
    if (p.repoUrl || p.repositoryUrl || p.githubUrl) pScore += 12;
    if (p.liveUrl) pScore += 11;
    detailPoints += pScore;
  }
  const avgDetail = detailPoints / count;
  score += Math.round(avgDetail);

  // 3. Live link verification results from project_live_checks (up to 35 points)
  try {
    const { data: linkChecks } = await admin
      .from('project_live_checks')
      .select('is_live, quality_score, passed, console_errors, mobile_friendly')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10);

    const checks = Array.isArray(linkChecks) ? linkChecks : [];
    if (checks.length > 0) {
      const passing = checks.filter(
        (c) => c.passed || (c.is_live && (Number(c.quality_score) || 0) >= 60)
      );
      if (passing.length > 0) {
        let totalQuality = 0;
        for (const c of passing) {
          let q = Number(c.quality_score) || 60;
          if (Array.isArray(c.console_errors) && c.console_errors.length > 0) {
            q = Math.max(0, q - 20);
          }
          if (c.mobile_friendly === false) {
            q = Math.max(0, q - 20);
          }
          totalQuality += q;
        }
        const avgQuality = totalQuality / passing.length;
        score += Math.round((avgQuality / 100) * 35);
      } else {
        score += 5;
      }
    } else {
      const hasLive = projects.some((p) => Boolean(p.liveUrl));
      if (hasLive) score += 15;
    }
  } catch {
    const hasLive = projects.some((p) => Boolean(p.liveUrl));
    if (hasLive) score += 15;
  }

  return Math.min(100, Math.max(0, score));
}

function extractLeetcodeUsername(raw: string): string {
  const cleaned = raw.trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
  const match = cleaned.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_\-]+)/i);
  if (match) return match[1];
  const simple = cleaned.replace(/^@/, '');
  if (/^[a-zA-Z0-9_\-]+$/.test(simple)) return simple;
  return '';
}

async function computeCodingPracticeScore(
  leetcodeUrl: string | null | undefined,
  studentId: string,
  admin: ReturnType<typeof createAdminClient>,
  currentCodingScore: number,
  existingReview?: unknown,
): Promise<{ score: number; review: LeetCodeStats | null }> {
  let score = 0;
  let review = normalizeLeetCodeStats(existingReview, leetcodeUrl ? extractLeetcodeUsername(leetcodeUrl) : '');

  // 1. Fetch live LeetCode stats via microservice or direct public GraphQL
  if (leetcodeUrl && leetcodeUrl.trim().length > 0) {
    const username = extractLeetcodeUsername(leetcodeUrl);
    if (username) {
      if (!review) {
        try {
          const response = await serviceRequest(
            `${getProfileReviewBaseUrl()}/review/leetcode/${encodeURIComponent(username)}`,
            { timeoutMs: 8_000, maxRetries: 1 },
          );
          review = normalizeLeetCodeStats(response, username);
        } catch {
          // The direct public API below is an independent fallback.
        }
      }

      if (!review || !review.exists || (review.total_solved === 0 && review.score === 0)) {
        try {
          const gqlRes = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              Referer: `https://leetcode.com/u/${encodeURIComponent(username)}/`,
            },
            cache: 'no-store',
            body: JSON.stringify({
              query: `query getUserProfile($username: String!) {
                matchedUser(username: $username) {
                  username
                  submitStats: submitStatsGlobal {
                    acSubmissionNum { difficulty count }
                  }
                  profile { ranking }
                }
                userContestRanking(username: $username) { rating globalRanking }
              }`,
              variables: { username },
            }),
          });
          if (gqlRes.ok) {
            const directReview = normalizeLeetCodeStats(await gqlRes.json(), username);
            if (directReview) review = directReview;
          }
        } catch {
          // Preserve the service response or prior verified score if LeetCode is unavailable.
        }
      }
    }

    if (review) score = review.score;
  }

  // 2. Completed Round 2 Coding Practice sessions in interview_sessions
  try {
    const { data: codingSessions } = await admin
      .from('interview_sessions')
      .select('score, result, config')
      .or(`student_id.eq.${studentId},user_id.eq.${studentId}`)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5);

    const sessions = Array.isArray(codingSessions) ? codingSessions : [];
    const codingOnly = sessions.filter((s) => {
      const cfg = isRecord(s.config) ? s.config : {};
      const res = isRecord(s.result) ? s.result : {};
      return cfg.type === 'coding' || cfg.round === 2 || Boolean(res.coding_result);
    });

    if (codingOnly.length > 0) {
      const bestSessionScore = Math.max(
        ...codingOnly.map((s) => {
          if (typeof s.score === 'number' && Number.isFinite(s.score)) return s.score;
          const res = isRecord(s.result) ? s.result : {};
          if (typeof res.interview_score === 'number' && Number.isFinite(res.interview_score)) return res.interview_score;
          return 75;
        })
      );
      score = Math.max(score, Math.round((bestSessionScore / 100) * 100));
    } else if (leetcodeUrl && !review && currentCodingScore > 0) {
      score = Math.max(score, currentCodingScore);
    }
  } catch {
    if (leetcodeUrl && !review && currentCodingScore > 0) {
      score = Math.max(score, currentCodingScore);
    }
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    review,
  };
}

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
    projects: 0,
    mock_interview: 0,
    github: 0,
    linkedin: 0,
    leetcode: 0,
    coding_practice: 0,
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
      const categories: (keyof ProfileScores)[] = [
        'resume',
        'projects',
        'mock_interview',
        'github',
        'linkedin',
        'leetcode',
        'coding_practice',
      ];
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

  if (scores.leetcode > 0 && !scores.coding_practice) scores.coding_practice = scores.leetcode;
  if (scores.coding_practice > 0 && !scores.leetcode) scores.leetcode = scores.coding_practice;

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
        const categories: (keyof ProfileScores)[] = ['resume', 'github', 'projects', 'linkedin', 'mock_interview', 'coding_practice'];
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
      let interviewQuery = admin
        .from('interview_sessions')
        .select('score, result');

      if (typeof (interviewQuery as unknown as { or?: unknown }).or === 'function') {
        interviewQuery = (interviewQuery as unknown as { or: (arg: string) => typeof interviewQuery }).or(`student_id.eq.${studentId},user_id.eq.${studentId}`);
      } else {
        interviewQuery = interviewQuery.eq('student_id', studentId);
      }

      const { data: latestInterview } = await interviewQuery
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
  } catch {
    // Optional fallback when interview_sessions query is not mocked or unavailable
  }

  return scores;
}

export async function POST(request?: Request): Promise<NextResponse> {
  let studentId: string | null = null;
  const admin = createAdminClient();

  try {
    const sessionClient = createServerSessionClient();
    let { data: { user } } = await sessionClient.auth.getUser();

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
    const forceRefresh = bodyData?.force_refresh === true || bodyData?.forceRefresh === true;

    const authHeader = request?.headers.get('authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    // If cookie session didn't resolve a user, verify bearer token if present
    if (!user && token) {
      try {
        const { data: tokenAuth } = await sessionClient.auth.getUser(token);
        if (tokenAuth?.user) {
          user = tokenAuth.user;
        }
      } catch {
        // Fall back to internal service key check below
      }
    }

    if (user) {
      // Standard Supabase session validation: forbid arbitrary userId spoofing
      if (requestedUserId && requestedUserId !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot analyze another user profile.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      studentId = user.id;
      // Secure service-to-service validation: strictly require configured secret
      const internalSecret = (
        process.env.INTERNAL_SERVICE_SECRET ||
        process.env.INTERNAL_SERVICE_KEY ||
        ''
      ).trim();

      if (internalSecret && token && token === internalSecret && requestedUserId) {
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
    if (!profile) throw new AnalysisError('Failed to parse student profile.', 404, 'PROFILE_NOT_FOUND');
    if (!profile.onboardingCompletedAt) {
      if (forceRefresh) {
        await admin.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', studentId);
      } else {
        return NextResponse.json(
          { error: 'Complete onboarding before starting analysis.', code: 'ONBOARDING_INCOMPLETE' },
          { status: 409 }
        );
      }
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
      if (typeof bodyData.leetcodeUrl === 'string') {
        updatePayload.leetcode_url = bodyData.leetcodeUrl.trim() || null;
      }
      if (typeof bodyData.codingProfileUrl === 'string') {
        updatePayload.coding_profile_url = bodyData.codingProfileUrl.trim() || null;
      }
      if (typeof bodyData.resumePath === 'string') {
        updatePayload.resume_pdf_path = bodyData.resumePath;
      }
      if (typeof bodyData.linkedinPath === 'string') {
        updatePayload.linkedin_pdf_path = bodyData.linkedinPath;
      }

      const { error: patchError } = await admin.from('profiles').update(updatePayload).eq('id', studentId);
      if (patchError) {
        throw new AnalysisError('Failed to save profile evidence before analysis.', 500, 'PROFILE_UPDATE_FAILED');
      }
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

    const effectiveLeetcodeUrl = typeof bodyData?.leetcodeUrl === 'string'
      ? bodyData.leetcodeUrl.trim()
      : typeof bodyData?.codingProfileUrl === 'string'
        ? bodyData.codingProfileUrl.trim()
        : profile.leetcodeUrl || profile.codingProfileUrl || '';

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: PRESERVE EXISTING SCORES (DEEP MERGE)
    // ──────────────────────────────────────────────────────────────────────────
    const currentScores = await fetchCurrentScores(admin, studentId);

    // Download documents for analysis if present
    const validResumePath = effectiveResumePath ? requireOwnedPath(effectiveResumePath, studentId, 'Resume') : null;
    let resumeBlob: Blob | null = null;
    let resumeAnalysisError: string | null = null;
    if (validResumePath) {
      const resumeDownload = await admin.storage.from('candidate-documents').download(validResumePath);
      if (resumeDownload.error || !resumeDownload.data) {
        resumeAnalysisError = `Resume could not be downloaded: ${resumeDownload.error?.message ?? 'Empty file'}`;
      } else {
        resumeBlob = resumeDownload.data;
      }
    }

    let linkedinDownloadData: Blob | null = null;
    let linkedinAnalysisError: string | null = null;
    if (effectiveLinkedinPath) {
      const validLinkedinPath = requireOwnedPath(effectiveLinkedinPath, studentId, 'LinkedIn profile');
      const linkedinDownload = await admin.storage.from('candidate-documents').download(validLinkedinPath);
      if (linkedinDownload.error || !linkedinDownload.data) {
        linkedinAnalysisError = `LinkedIn PDF could not be downloaded: ${linkedinDownload.error?.message ?? 'Empty file'}`;
      } else {
        linkedinDownloadData = linkedinDownload.data;
      }
    }

    // Attempt AI scoring service invocation
    let review: unknown = null;
    if (resumeBlob) {
      try {
        const form = new FormData();
        form.append('github_username', effectiveGithubUsername);
        form.append('leetcode_url', effectiveLeetcodeUrl);
        form.append('force_refresh', String(forceRefresh));
        const isResumeDocx = validResumePath ? validResumePath.toLowerCase().endsWith('.docx') : false;
        form.append('resume', resumeBlob, isResumeDocx ? 'resume.docx' : 'resume.pdf');
        if (linkedinDownloadData) {
          form.append('linkedin_pdf', linkedinDownloadData, 'linkedin.pdf');
        }
        review = await serviceRequest(`${getProfileReviewBaseUrl()}/analyze-profile`, {
          method: 'POST',
          body: form,
          timeoutMs: 50_000,
          maxRetries: 0,
        });
      } catch (exc) {
        const message = exc instanceof Error ? exc.message : 'AI analyzer service failure';
        const isTimeout = message.toLowerCase().includes('timed out') || message.toLowerCase().includes('timeout');
        throw new AnalysisError(
          `AI analyzer failed or timed out: ${message}`,
          isTimeout ? 504 : 502,
          isTimeout ? 'AI_ANALYZER_TIMEOUT' : 'AI_ANALYZER_FAILED',
        );
      }
    }

    const safeReview = isRecord(review) ? review : {};
    const resumeReview = isRecord(safeReview.resume_review) ? safeReview.resume_review : null;
    let githubReview = isRecord(safeReview.github_review) ? safeReview.github_review : null;
    let linkedinReview = isRecord(safeReview.linkedin_review) ? safeReview.linkedin_review : null;
    let githubAnalysisError = typeof safeReview.github_error === 'string' ? safeReview.github_error : null;
    linkedinAnalysisError = typeof safeReview.linkedin_error === 'string'
      ? safeReview.linkedin_error
      : linkedinAnalysisError;

    // GitHub must also be recalculated when no resume is present. The combined
    // analyzer only runs with a resume, so use its dedicated endpoint as needed.
    if (effectiveGithubUsername && !githubReview) {
      try {
        const response = await serviceRequest(
          `${getProfileReviewBaseUrl()}/review/github/${encodeURIComponent(effectiveGithubUsername)}`,
          { timeoutMs: 15_000, maxRetries: 1 },
        );
        githubReview = isRecord(response) ? response : null;
      } catch (error) {
        githubAnalysisError = error instanceof Error ? error.message : 'GitHub profile verification failed.';
      }
    }

    if (linkedinDownloadData && !linkedinReview) {
      try {
        const linkedinForm = new FormData();
        linkedinForm.append('file', linkedinDownloadData, 'linkedin.pdf');
        const response = await serviceRequest(`${getProfileReviewBaseUrl()}/review/linkedin`, {
          method: 'POST',
          body: linkedinForm,
          timeoutMs: 30_000,
        });
        linkedinReview = isRecord(response) ? response : null;
      } catch (error) {
        linkedinAnalysisError = error instanceof Error ? error.message : 'LinkedIn PDF verification failed.';
      }
    }

    const newResumeScore = resumeReview ? readNumber(resumeReview.score) : null;
    const newGithubScore = githubReview ? readNumber(githubReview.score) : null;
    const newLinkedinScore = linkedinReview ? readNumber(linkedinReview.score) : null;

    // Check for latest completed mock interview score if not in currentScores
    let mockInterviewScore = currentScores.mock_interview;
    if (!mockInterviewScore) {
      try {
        let interviewQuery = admin
          .from('interview_sessions')
          .select('score, result');

        if (typeof (interviewQuery as unknown as { or?: unknown }).or === 'function') {
          interviewQuery = (interviewQuery as unknown as { or: (arg: string) => typeof interviewQuery }).or(`student_id.eq.${studentId},user_id.eq.${studentId}`);
        } else if (typeof interviewQuery.eq === 'function') {
          interviewQuery = interviewQuery.eq('student_id', studentId);
        }

        if (typeof interviewQuery.eq === 'function') {
          const { data: latestInterview } = await interviewQuery
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
      } catch {
        // Optional fallback when interview_sessions query is not mocked or unavailable
      }
    }

    // Merge State: preserve untouched categories like GitHub and Mock Interview.
    // Zero fake passes: only real parsed/calculated scores or preserved verified scores.
    const updatedScores: ProfileScores = {
      resume: (typeof newResumeScore === 'number')
        ? newResumeScore
        : (effectiveResumePath ? currentScores.resume : 0),

      projects: currentScores.projects > 0 ? currentScores.projects : 0,

      mock_interview: mockInterviewScore > 0 ? mockInterviewScore : 0,

      github: (typeof newGithubScore === 'number')
        ? newGithubScore
        : (effectiveGithubUsername ? currentScores.github : 0),

      linkedin: (typeof newLinkedinScore === 'number')
        ? newLinkedinScore
        : (effectiveLinkedinPath ? currentScores.linkedin : 0),

      leetcode: currentScores.leetcode > 0 ? currentScores.leetcode : (currentScores.coding_practice > 0 ? currentScores.coding_practice : 0),

      coding_practice: currentScores.coding_practice > 0 ? currentScores.coding_practice : (currentScores.leetcode > 0 ? currentScores.leetcode : 0),

      co_curricular: extractNumericScore(currentScores.co_curricular ?? (rawProfile as Record<string, unknown>)?.co_curricular),
    };

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: DERIVED "PROJECTS" RECALCULATION
    // Factor in actual parsed project data and live-link check results
    // ──────────────────────────────────────────────────────────────────────────
    const projectsScore = await computeProjectsScore(
      profile.projects,
      studentId,
      admin
    );
    updatedScores.projects = projectsScore;

    // Derived "Coding Practice" (LeetCode & problem solving) recalculation
    const codingPractice = await computeCodingPracticeScore(
      effectiveLeetcodeUrl,
      studentId,
      admin,
      currentScores.coding_practice > 0 ? currentScores.coding_practice : currentScores.leetcode,
      safeReview.leetcode_review,
    );
    updatedScores.coding_practice = codingPractice.score;
    updatedScores.leetcode = codingPractice.score;

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: MASTER READINESS CALCULATION (CANONICAL 7-CATEGORY 100-POINT MATRIX)
    // Formula: (resume * 0.25) + (projects * 0.25) + (mock * 0.20) + (github * 0.10) + (coding_practice * 0.10) + (linkedin * 0.05) + (co_curricular * 0.05)
    // Math explicitly caps LeetCode's contribution at 10 points.
    // ──────────────────────────────────────────────────────────────────────────
    const leetcodeContribution = Math.min(10, Math.max(0, updatedScores.leetcode * 0.10));
    const coCurricularScore = updatedScores.co_curricular ?? 0;

    const totalReadiness = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          (updatedScores.resume * 0.25) +
          (projectsScore * 0.25) +
          (updatedScores.mock_interview * 0.20) +
          (updatedScores.github * 0.10) +
          (updatedScores.linkedin * 0.05) +
          leetcodeContribution +
          (coCurricularScore * 0.05)
        )
      )
    );

    const breakdown: Record<string, { raw_score: number; weight: number; weighted_points: number; max_points: number; present: boolean }> = {
      resume: {
        raw_score: updatedScores.resume,
        weight: 0.25,
        weighted_points: Math.round(updatedScores.resume * 0.25 * 10) / 10,
        max_points: 25,
        present: updatedScores.resume > 0,
      },
      projects: {
        raw_score: projectsScore,
        weight: 0.25,
        weighted_points: Math.round(projectsScore * 0.25 * 10) / 10,
        max_points: 25,
        present: projectsScore > 0,
      },
      mock_interview: {
        raw_score: updatedScores.mock_interview,
        weight: 0.20,
        weighted_points: Math.round(updatedScores.mock_interview * 0.20 * 10) / 10,
        max_points: 20,
        present: updatedScores.mock_interview > 0,
      },
      github: {
        raw_score: updatedScores.github,
        weight: 0.10,
        weighted_points: Math.round(updatedScores.github * 0.10 * 10) / 10,
        max_points: 10,
        present: updatedScores.github > 0,
      },
      linkedin: {
        raw_score: updatedScores.linkedin,
        weight: 0.05,
        weighted_points: Math.round(updatedScores.linkedin * 0.05 * 10) / 10,
        max_points: 5,
        present: updatedScores.linkedin > 0,
      },
      leetcode: {
        raw_score: updatedScores.leetcode,
        weight: 0.10,
        weighted_points: Math.round(leetcodeContribution * 10) / 10,
        max_points: 10,
        present: updatedScores.leetcode > 0,
      },
      coding_practice: {
        raw_score: updatedScores.leetcode,
        weight: 0.10,
        weighted_points: Math.round(leetcodeContribution * 10) / 10,
        max_points: 10,
        present: updatedScores.leetcode > 0,
      },
      co_curricular: {
        raw_score: coCurricularScore,
        weight: 0.05,
        weighted_points: Math.round(coCurricularScore * 0.05 * 10) / 10,
        max_points: 5,
        present: coCurricularScore > 0,
      },
    };

    const readinessLevel = totalReadiness >= 75
      ? 'Placement ready'
      : totalReadiness >= 50
        ? 'Almost ready'
        : 'Not ready';

    const categories: (keyof ProfileScores)[] = [
      'resume',
      'projects',
      'mock_interview',
      'github',
      'coding_practice',
      'linkedin',
      'co_curricular',
    ];

    const missingComponents = categories.filter((cat) => (updatedScores[cat] ?? 0) <= 0);

    const topActions = categories
      .map((cat) => {
        const weight = CATEGORY_WEIGHTS[cat];
        const raw = updatedScores[cat] ?? 0;
        const potentialPointGain = Math.round((100 - raw) * weight);
        return {
          category: cat,
          potentialPointGain,
        };
      })
      .filter(({ potentialPointGain }) => potentialPointGain > 0)
      .sort((a, b) => b.potentialPointGain - a.potentialPointGain)
      .slice(0, 5)
      .map(({ category, potentialPointGain }, index) => ({
        rank: index + 1,
        category: CATEGORY_NAMES[category],
        action: CATEGORY_RECOMMENDATIONS[category],
        potential_point_gain: potentialPointGain,
        description: `${CATEGORY_NAMES[category]} currently contributes ${breakdown[category]?.weighted_points ?? 0} of ${breakdown[category]?.max_points ?? 0} points.`,
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
      ...(isRecord(review) ? review : {}),
      ...(githubReview ? { github_review: githubReview } : {}),
      ...(linkedinReview ? { linkedin_review: linkedinReview } : {}),
      ...(codingPractice.review ? { leetcode_review: codingPractice.review } : {}),
      ...(resumeAnalysisError ? { resume_error: resumeAnalysisError } : {}),
      ...(githubAnalysisError ? { github_error: githubAnalysisError } : {}),
      ...(linkedinAnalysisError ? { linkedin_error: linkedinAnalysisError } : {}),
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

    // Database Commit 3: keep the canonical profile score snapshot in sync.
    const { error: profileScoreSaveError } = await admin.from('profiles').update({
        scores: updatedScores,
        updated_at: completedAt,
      }).eq('id', studentId);
    if (profileScoreSaveError) {
      throw new AnalysisError('Failed to persist profile scores.', 500, 'PROFILE_SCORE_SAVE_FAILED');
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
      force_refresh: forceRefresh,
      calculationSource: 'deep_merge_v2',
    });
  } catch (error) {
    const errorId = crypto.randomUUID();
    console.warn(`[ProfileAnalysisFailed:${errorId}]`, error);
    const message = error instanceof Error ? error.message : 'Profile analysis failed.';

    if (studentId) {
      try {
        const failedAt = new Date().toISOString();
        await admin.from('candidate_profile_reviews').upsert({
          student_id: studentId,
          status: 'failed',
          error_message: message,
          updated_at: failedAt,
        }, { onConflict: 'student_id' });
      } catch {
        // The original analysis error remains the response source of truth.
      }
    }

    return NextResponse.json({
      error: message,
      code: error instanceof AnalysisError ? error.code : 'ANALYSIS_FAILED',
      errorId,
    }, { status: error instanceof AnalysisError ? error.status : 500 });
  }
}
