import type {
  ApplicationStatus,
  JobApplication,
  JobPosting,
  JobStatus,
  ReadinessAction,
  ReadinessScore,
} from '@/types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function clampScore(value: unknown): number {
  return Math.round(Math.min(100, Math.max(0, readNumber(value))));
}

function normalizeReadinessAction(value: unknown): ReadinessAction | null {
  if (typeof value === 'string' && value.trim()) {
    return { title: value.trim(), priority: 'Recommended' };
  }
  if (!isRecord(value)) return null;

  const title = readString(value.title) || readString(value.action) || readString(value.description);
  if (!title.trim()) return null;

  return {
    title: title.trim(),
    priority: readString(value.priority, 'Recommended'),
  };
}

export function normalizeReadinessScore(value: unknown): ReadinessScore | null {
  if (!isRecord(value)) return null;

  const rawActions = Array.isArray(value.top_actions) ? value.top_actions : [];
  const topActions = rawActions
    .map(normalizeReadinessAction)
    .filter((action): action is ReadinessAction => action !== null)
    .slice(0, 5);

  const breakdown: Record<string, number> = {};
  if (isRecord(value.breakdown)) {
    for (const [key, score] of Object.entries(value.breakdown)) {
      breakdown[key] = clampScore(score);
    }
  }

  return {
    totalScore: clampScore(value.total_score),
    readinessLevel: readString(value.readiness_level, 'Not ready'),
    topActions,
    breakdown,
    updatedAt: readString(value.updated_at) || undefined,
  };
}

function normalizeEmploymentType(value: unknown): JobPosting['employmentType'] {
  const normalized = readString(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('intern')) return 'internship';
  if (normalized === 'part_time') return 'part_time';
  if (normalized === 'contract') return 'contract';
  return 'full_time';
}

function normalizeJobStatus(value: unknown): JobStatus {
  return readString(value).toLowerCase() === 'unpublished' ? 'unpublished' : 'published';
}

export function normalizeDiscoveredJobs(value: unknown): JobPosting[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): JobPosting[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const title = readString(item.title);
    const company = readString(item.company);
    if (!id || !title || !company) return [];

    const matchReason = readString(item.match_reason);
    const createdAt = readString(item.created_at, new Date().toISOString());
    return [{
      id,
      title,
      company,
      location: readString(item.location, item.is_remote === true ? 'Remote' : 'Location not specified'),
      employmentType: normalizeEmploymentType(item.employment_type ?? item.job_type),
      description: readString(item.description, matchReason || 'Job discovered by the placement automation service.'),
      requiredSkills: readStringArray(item.required_skills ?? item.matched_skills),
      applicationUrl: readString(item.url) || undefined,
      status: normalizeJobStatus(item.publication_status ?? item.status),
      createdAt,
      updatedAt: readString(item.updated_at, createdAt),
      source: readString(item.source) || undefined,
      matchedSkills: readStringArray(item.matched_skills),
      matchScore: item.relevance_score === null || item.relevance_score === undefined
        ? undefined
        : clampScore(item.relevance_score),
      matchReason: matchReason || undefined,
      isRemote: typeof item.is_remote === 'boolean' ? item.is_remote : undefined,
      postedAt: readString(item.posted_at) || undefined,
    }];
  });
}

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return ['saved', 'applied', 'shortlisted', 'interviewing', 'offer', 'rejected'].includes(value);
}

function normalizeApplicationStatus(value: unknown): ApplicationStatus {
  const normalized = readString(value).toLowerCase();
  if (normalized === 'interview') return 'interviewing';
  return isApplicationStatus(normalized) ? normalized : 'saved';
}

export function normalizeApplications(value: unknown): JobApplication[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): JobApplication[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const userId = readString(item.student_id);
    const company = readString(item.company);
    const jobTitle = readString(item.role);
    if (!id || !userId || !company || !jobTitle) return [];

    const createdAt = readString(item.created_at, new Date().toISOString());
    const appliedAt = readString(item.applied_at);
    return [{
      id,
      userId,
      company,
      jobTitle,
      status: normalizeApplicationStatus(item.status),
      applicationDate: (appliedAt || createdAt).slice(0, 10),
      notes: readString(item.notes) || undefined,
      jobPostingUrl: readString(item.url) || undefined,
      createdAt,
    }];
  });
}
