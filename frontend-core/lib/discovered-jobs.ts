import type { DiscoveredJob } from '@/types';

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
