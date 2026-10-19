import type {
  CandidateProfileReview,
  CandidateProfileReviewRecord,
  CandidateProject,
  CoCurricularProfile,
  ProfileAnalysisStatus,
  UserProfile,
  UserRole,
} from '@/types';

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function normalizeProject(value: unknown): CandidateProject | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const name = readString(value.name);
  const repositoryUrl = readString(value.repositoryUrl);
  const description = readString(value.description);
  if (!id || !name || !repositoryUrl || !description) return null;
  return {
    id,
    name,
    repositoryUrl,
    liveUrl: readString(value.liveUrl) || undefined,
    description,
  };
}

function normalizeCoCurricular(value: unknown): CoCurricularProfile | undefined {
  if (!isRecord(value)) return undefined;
  const hackathonsCount = Number(value.hackathonsCount);
  const certificationsCount = Number(value.certificationsCount);
  return {
    hackathonsCount: Number.isFinite(hackathonsCount) ? Math.max(0, Math.floor(hackathonsCount)) : 0,
    certificationsCount: Number.isFinite(certificationsCount) ? Math.max(0, Math.floor(certificationsCount)) : 0,
    clubLeadership: value.clubLeadership === true,
  };
}

function isRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'admin';
}

export function normalizeUserProfile(value: unknown): UserProfile | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const email = readString(value.email);
  const displayName = readString(value.display_name);
  const createdAt = readString(value.created_at);
  if (!id || !email || !displayName || !createdAt || !isRole(value.role)) return null;

  const projects = Array.isArray(value.projects)
    ? value.projects.map(normalizeProject).filter((project): project is CandidateProject => project !== null)
    : [];

  return {
    id,
    email,
    displayName,
    role: value.role,
    createdAt,
    targetRole: readString(value.target_role) || undefined,
    targetLocations: readStringArray(value.target_locations),
    skills: readStringArray(value.skills),
    githubUsername: readString(value.github_username) || undefined,
    resumePdfPath: readString(value.resume_pdf_path) || undefined,
    linkedinPdfPath: readString(value.linkedin_pdf_path) || undefined,
    projects,
    coCurricular: normalizeCoCurricular(value.co_curricular),
    onboardingCompletedAt: readString(value.onboarding_completed_at) || undefined,
    updatedAt: readString(value.updated_at) || undefined,
  };
}

function isAnalysisStatus(value: unknown): value is ProfileAnalysisStatus {
  return value === 'pending' || value === 'processing' || value === 'completed' || value === 'failed';
}

export function normalizeProfileReviewRecord(value: unknown): CandidateProfileReviewRecord | null {
  if (!isRecord(value) || !isAnalysisStatus(value.status)) return null;
  const studentId = readString(value.student_id);
  const updatedAt = readString(value.updated_at);
  if (!studentId || !updatedAt) return null;
  return {
    studentId,
    status: value.status,
    result: isRecord(value.result) ? value.result as unknown as CandidateProfileReview : null,
    errorMessage: readString(value.error_message) || undefined,
    updatedAt,
  };
}
