type ReadinessCategory =
  | 'resume'
  | 'projects'
  | 'mock_interview'
  | 'github'
  | 'coding_practice'
  | 'linkedin'
  | 'co_curricular';

interface ScoredEvidence {
  score: number;
  [key: string]: unknown;
}

export interface ReadinessProjectInput {
  name?: string;
  live_url?: string | null;
  repo_url?: string | null;
  live_link_score: number;
  code_quality_score: number;
  documentation_score: number;
  has_readme?: boolean;
  is_live?: boolean;
}

export interface ReadinessCalculationInput {
  student_id: string;
  student_name?: string;
  resume: ScoredEvidence | null;
  projects: ReadinessProjectInput[];
  interview_session_result: unknown;
  github: ScoredEvidence | null;
  coding_practice?: ScoredEvidence | null;
  linkedin: ScoredEvidence | null;
  co_curricular: ScoredEvidence | null;
}

interface CategoryScore {
  weight: number;
  raw_score: number;
  weighted_points: number;
  present: boolean;
}

interface ReadinessActionPayload {
  rank: number;
  category: string;
  action: string;
  potential_point_gain: number;
  description: string;
}

export interface ReadinessCalculationResult {
  student_id: string;
  algorithm_version: string;
  total_score: number;
  is_provisional: boolean;
  missing_components: ReadinessCategory[];
  readiness_level: 'Not ready' | 'Almost ready' | 'Placement ready';
  category_scores: Record<ReadinessCategory, CategoryScore>;
  top_actions: ReadinessActionPayload[];
  is_placement_ready: boolean;
}

const WEIGHTS: Record<ReadinessCategory, number> = {
  resume: 0.25,
  projects: 0.25,
  mock_interview: 0.2,
  github: 0.1,
  coding_practice: 0.1,
  linkedin: 0.05,
  co_curricular: 0.05,
};

const CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  resume: 'Resume',
  projects: 'Projects',
  mock_interview: 'Mock Interview',
  github: 'GitHub',
  coding_practice: 'Coding Practice',
  linkedin: 'LinkedIn',
  co_curricular: 'Co-curricular',
};

const CATEGORY_ACTIONS: Record<ReadinessCategory, string> = {
  resume: 'Add quantified outcomes and role-specific keywords to your resume',
  projects: 'Add deployed projects with live links and complete documentation',
  mock_interview: 'Complete a focused AI mock interview and review the feedback',
  github: 'Pin representative repositories and improve their READMEs',
  coding_practice: 'Solve more DSA problems on LeetCode/HackerRank to improve problem-solving speed',
  linkedin: 'Align your headline, skills, and experience with your target role',
  co_curricular: 'Add verified certifications, hackathons, or leadership evidence',
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readInterviewScore(value: unknown): number | null {
  if (!isRecord(value) || value.contract_version !== 'v0') return null;
  return typeof value.interview_score === 'number' && Number.isFinite(value.interview_score)
    ? clampScore(value.interview_score)
    : null;
}

function calculateProjectScore(projects: readonly ReadinessProjectInput[]): number | null {
  if (projects.length === 0) return null;
  const total = projects.reduce((sum, project) => sum
    + clampScore(project.live_link_score) * 0.4
    + clampScore(project.code_quality_score) * 0.4
    + clampScore(project.documentation_score) * 0.2, 0);
  return round(total / projects.length);
}

export function calculateReadinessLocally(input: ReadinessCalculationInput): ReadinessCalculationResult {
  const scores: Record<ReadinessCategory, number | null> = {
    resume: input.resume ? clampScore(input.resume.score) : null,
    projects: calculateProjectScore(input.projects),
    mock_interview: readInterviewScore(input.interview_session_result),
    github: input.github ? clampScore(input.github.score) : null,
    coding_practice: input.coding_practice ? clampScore(input.coding_practice.score) : null,
    linkedin: input.linkedin ? clampScore(input.linkedin.score) : null,
    co_curricular: input.co_curricular ? clampScore(input.co_curricular.score) : null,
  };

  const isInterviewProvisional = isRecord(input.interview_session_result) &&
    (input.interview_session_result.is_provisional === true || input.interview_session_result.is_fallback === true);

  const categories = Object.keys(WEIGHTS) as ReadinessCategory[];
  const missingComponents = categories.filter((category) => scores[category] === null);
  const categoryScores = Object.fromEntries(categories.map((category) => {
    const rawScore = scores[category] ?? 0;
    return [category, {
      weight: WEIGHTS[category],
      raw_score: rawScore,
      weighted_points: round(rawScore * WEIGHTS[category]),
      present: scores[category] !== null,
    }];
  })) as Record<ReadinessCategory, CategoryScore>;

  const totalScore = round(categories.reduce(
    (total, category) => total + categoryScores[category].weighted_points,
    0,
  ));
  const readinessLevel = totalScore >= 75
    ? 'Placement ready'
    : totalScore >= 50
      ? 'Almost ready'
      : 'Not ready';
  const topActions = categories
    .map((category) => ({
      category,
      potentialPointGain: round((100 - categoryScores[category].raw_score) * WEIGHTS[category]),
    }))
    .filter(({ potentialPointGain }) => potentialPointGain > 0)
    .sort((left, right) => right.potentialPointGain - left.potentialPointGain)
    .slice(0, 5)
    .map(({ category, potentialPointGain }, index): ReadinessActionPayload => ({
      rank: index + 1,
      category: CATEGORY_LABELS[category],
      action: CATEGORY_ACTIONS[category],
      potential_point_gain: potentialPointGain,
      description: `${CATEGORY_LABELS[category]} currently contributes ${categoryScores[category].weighted_points} of ${WEIGHTS[category] * 100} points.`,
    }));

  return {
    student_id: input.student_id,
    algorithm_version: 'v2.0.0',
    total_score: totalScore,
    is_provisional: missingComponents.length > 0,
    missing_components: missingComponents,
    readiness_level: readinessLevel,
    category_scores: categoryScores,
    top_actions: topActions,
    is_placement_ready: readinessLevel === 'Placement ready' && missingComponents.length === 0,
  };
}
