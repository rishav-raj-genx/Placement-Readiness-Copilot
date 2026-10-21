import type { JobPosting } from '@/types';

export interface JobMatchProfile {
  id?: string;
  targetRole: string;
  skills: string[];
}

const EMPLOYMENT_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  employmentType: JobPosting['employmentType'];
}> = [
  { pattern: /\b(intern|internship|co-op)\b/i, employmentType: 'internship' },
  { pattern: /\bpart[\s-]?time\b/i, employmentType: 'part_time' },
  { pattern: /\bcontract(or)?\b/i, employmentType: 'contract' },
  { pattern: /\bfull[\s-]?time\b/i, employmentType: 'full_time' },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();
}

function targetTerms(targetRole: string): string[] {
  return normalize(targetRole)
    .split(/\s+/)
    .filter((term) => term.length > 2 && !['intern', 'internship', 'time', 'role'].includes(term));
}

export function inferEmploymentType(targetRole: string): JobPosting['employmentType'] | null {
  return EMPLOYMENT_PATTERNS.find(({ pattern }) => pattern.test(targetRole))?.employmentType ?? null;
}

export function matchesJobProfile(job: JobPosting, profile: JobMatchProfile): boolean {
  if (job.status !== 'published') return false;

  const preferredEmploymentType = inferEmploymentType(profile.targetRole);
  if (preferredEmploymentType && job.employmentType !== preferredEmploymentType) return false;

  const terms = targetTerms(profile.targetRole);
  if (terms.length === 0) return false;

  const normalizedTitle = normalize(job.title);
  const normalizedDescription = normalize(job.description);
  const normalizedRequirements = job.requiredSkills.map(normalize).filter(Boolean);
  const roleAligned = terms.some((term) =>
    normalizedTitle.includes(term)
    || normalizedDescription.includes(term)
    || normalizedRequirements.some((requirement) => requirement.includes(term)),
  );
  if (!roleAligned) return false;

  const normalizedSkills = profile.skills.map(normalize).filter(Boolean);
  if (normalizedSkills.length === 0 || normalizedRequirements.length === 0) return true;

  return normalizedSkills.some((skill) =>
    normalizedRequirements.some((requirement) =>
      requirement === skill || requirement.includes(skill) || skill.includes(requirement),
    ),
  );
}
