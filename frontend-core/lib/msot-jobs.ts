import { normalizeDiscoveredJobs } from '@/lib/discovered-jobs';
import type { DiscoveredJob } from '@/types';

type UnknownRecord = Record<string, unknown>;

export interface MsotApplicant {
  userId: string;
  displayName: string;
  email: string;
  status: string;
  appliedAt: string;
}

export interface MsotJobWithApplicants extends DiscoveredJob {
  applicants: MsotApplicant[];
}

interface ApplicationRecord {
  studentId: string;
  jobId: string;
  status: string;
  appliedAt: string;
}

interface ProfileRecord {
  id: string;
  displayName: string;
  email: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeApplicationRecords(value: unknown): ApplicationRecord[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): ApplicationRecord[] => {
    if (!isRecord(item)) return [];
    const studentId = readString(item.student_id);
    const jobId = readString(item.job_id);
    if (!studentId || !jobId) return [];

    return [{
      studentId,
      jobId,
      status: readString(item.status) || 'applied',
      appliedAt: readString(item.applied_at) || readString(item.created_at),
    }];
  });
}

function normalizeProfileRecords(value: unknown): ProfileRecord[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): ProfileRecord[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    if (!id) return [];

    return [{
      id,
      displayName: readString(item.display_name),
      email: readString(item.email),
    }];
  });
}

export function collectApplicationStudentIds(value: unknown): string[] {
  return Array.from(new Set(normalizeApplicationRecords(value).map((application) => application.studentId)));
}

function timeValue(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildMsotJobApplicantView(
  jobsValue: unknown,
  applicationsValue: unknown,
  profilesValue: unknown,
): MsotJobWithApplicants[] {
  const jobs = normalizeDiscoveredJobs(jobsValue).filter((job) => job.is_msot_post);
  const applications = normalizeApplicationRecords(applicationsValue);
  const profiles = new Map(normalizeProfileRecords(profilesValue).map((profile) => [profile.id, profile]));

  return jobs.map((job): MsotJobWithApplicants => {
    const applicants = applications
      .filter((application) => application.jobId === job.id)
      .map((application): MsotApplicant => {
        const profile = profiles.get(application.studentId);
        return {
          userId: application.studentId,
          displayName: profile?.displayName || `Candidate ${application.studentId.slice(0, 8)}`,
          email: profile?.email || '',
          status: application.status,
          appliedAt: application.appliedAt,
        };
      })
      .sort((first, second) => timeValue(second.appliedAt) - timeValue(first.appliedAt));

    return { ...job, applicants };
  });
}
