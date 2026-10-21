import type { DiscoveredJob } from '@/types';

export const DISCOVERED_JOB_COLUMNS = [
  'id',
  'title',
  'company',
  'location',
  'url',
  'source',
  'description',
  'required_skills',
  'matched_skills',
  'relevance_score',
  'match_reason',
  'is_remote',
  'job_type',
  'employment_type',
  'publication_status',
  'is_msot_post',
  'posted_at',
].join(',');

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const values = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(values));
}

function readNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readHttpUrl(value: unknown): string {
  const candidate = readString(value);
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function isEmploymentType(value: unknown): value is DiscoveredJob['employment_type'] {
  return value === 'full_time'
    || value === 'part_time'
    || value === 'contract'
    || value === 'internship';
}

function isPublicationStatus(value: unknown): value is DiscoveredJob['publication_status'] {
  return value === 'published' || value === 'unpublished';
}

export function normalizeDiscoveredJob(value: unknown): DiscoveredJob | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const title = readString(value.title);
  const company = readString(value.company);
  const url = readHttpUrl(value.url);
  if (!id || !title || !company || !url) return null;
  if (!isEmploymentType(value.employment_type) || !isPublicationStatus(value.publication_status)) {
    return null;
  }

  return {
    id,
    title,
    company,
    location: readString(value.location),
    url,
    source: readString(value.source),
    description: readString(value.description),
    required_skills: readStringArray(value.required_skills),
    matched_skills: readStringArray(value.matched_skills),
    relevance_score: readNumber(value.relevance_score),
    match_reason: readString(value.match_reason),
    is_remote: value.is_remote === true,
    job_type: readString(value.job_type),
    employment_type: value.employment_type,
    publication_status: value.publication_status,
    is_msot_post: value.is_msot_post === true,
    posted_at: readString(value.posted_at),
  };
}

export function normalizeDiscoveredJobs(value: unknown): DiscoveredJob[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeDiscoveredJob)
    .filter((job): job is DiscoveredJob => job !== null);
}

export function normalizeProfileSkills(value: unknown): string[] {
  return readStringArray(value);
}

function normalizedSkill(value: string): string {
  return value.trim().toLowerCase();
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function personalizeAndRankDiscoveredJobs(
  jobs: DiscoveredJob[],
  profileSkills: string[],
): DiscoveredJob[] {
  const candidateSkills = new Set(profileSkills.map(normalizedSkill));
  const personalized = jobs.map((job): DiscoveredJob => {
    if (!job.is_msot_post) return job;

    const matchedSkills = job.required_skills.filter((skill) => candidateSkills.has(normalizedSkill(skill)));
    const relevanceScore = job.required_skills.length > 0
      ? Math.round((matchedSkills.length / job.required_skills.length) * 100)
      : 0;

    return {
      ...job,
      matched_skills: matchedSkills,
      relevance_score: relevanceScore,
      match_reason: matchedSkills.length > 0
        ? `Official MSOT opportunity matching ${matchedSkills.length} of your profile skills.`
        : 'Official opportunity published by the MSOT placement team.',
    };
  });

  return personalized.sort((first, second) => {
    if (first.is_msot_post !== second.is_msot_post) return first.is_msot_post ? -1 : 1;
    if (first.relevance_score !== second.relevance_score) {
      return second.relevance_score - first.relevance_score;
    }
    return timestamp(second.posted_at) - timestamp(first.posted_at);
  });
}

export async function fetchDiscoveredJobs(
  supabase: { from: (table: string) => any },
  user: { id: string }
) {
  const { data: jobs, error } = await supabase
    .from('discovered_jobs')
    .select('*')
    .or(`student_id.eq.${user.id},is_msot_post.eq.true`)
    .eq('publication_status', 'published')
    .order('is_msot_post', { ascending: false })
    .order('relevance_score', { ascending: false });

  if (error) {
    console.error("Job Fetch Error:", error.message);
  }
  return { data: jobs, error };
}

