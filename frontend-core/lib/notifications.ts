import type { ProfileAnalysisStatus } from '@/types';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'success' | 'info' | 'warning';
}

export interface NotificationFeedState {
  userId: string | null;
  targetRole?: string;
  profileStatus?: ProfileAnalysisStatus;
  readinessScore?: number;
  profileUpdatedAt?: string;
  remainingInterviews: number;
  interviewUpdatedAt?: string;
  matchedJobCount: number;
  jobsHydrated: boolean;
  latestJobId?: string;
  jobsUpdatedAt?: string;
}

function firstTimestamp(...values: Array<string | undefined>): string {
  return values.find((value) => value && !Number.isNaN(Date.parse(value)))
    ?? '1970-01-01T00:00:00.000Z';
}

export function buildNotificationFeed(
  state: NotificationFeedState,
  readIds: readonly string[],
): NotificationItem[] {
  if (!state.userId) return [];

  const readSet = new Set(readIds);
  const profileTimestamp = firstTimestamp(state.profileUpdatedAt);
  const roundedScore = typeof state.readinessScore === 'number'
    ? Math.round(state.readinessScore)
    : null;
  const profileComplete = roundedScore !== null || state.profileStatus === 'completed';
  const profileId = `profile-${state.userId}-${state.profileStatus ?? 'pending'}-${roundedScore ?? 'none'}-${profileTimestamp}`;

  const profileNotification: NotificationItem = {
    id: profileId,
    title: profileComplete ? 'Profile readiness updated' : 'Profile analysis',
    message: profileComplete
      ? `Profile analysis complete: Readiness score updated.${roundedScore === null ? '' : ` Current score: ${roundedScore}%.`}`
      : state.profileStatus === 'failed'
        ? 'Profile analysis needs attention. Review your profile inputs and try again.'
        : state.profileStatus === 'processing'
          ? 'Profile analysis is processing your latest candidate evidence.'
          : 'Complete your profile analysis to unlock readiness recommendations.',
    timestamp: profileTimestamp,
    read: readSet.has(profileId),
    type: profileComplete ? 'success' : state.profileStatus === 'failed' ? 'warning' : 'info',
  };

  const interviewTimestamp = firstTimestamp(state.interviewUpdatedAt, state.profileUpdatedAt);
  const targetTrack = state.targetRole?.trim() || 'your target role';
  const interviewId = `interview-${state.userId}-${state.remainingInterviews}-${targetTrack}-${interviewTimestamp}`;
  const interviewNotification: NotificationItem = {
    id: interviewId,
    title: 'AI interview practice',
    message: `${state.remainingInterviews} Mock interview credit${state.remainingInterviews === 1 ? '' : 's'} available for ${targetTrack} track.`,
    timestamp: interviewTimestamp,
    read: readSet.has(interviewId),
    type: state.remainingInterviews > 0 ? 'info' : 'warning',
  };

  const jobsTimestamp = firstTimestamp(state.jobsUpdatedAt, state.profileUpdatedAt);
  const jobsState = state.jobsHydrated ? state.matchedJobCount : 'syncing';
  const jobsId = `jobs-${state.userId}-${state.latestJobId ?? 'none'}-${jobsState}-${jobsTimestamp}`;
  const jobsNotification: NotificationItem = {
    id: jobsId,
    title: state.matchedJobCount > 0
      ? `${state.matchedJobCount} ATS job match${state.matchedJobCount === 1 ? '' : 'es'}`
      : 'ATS job matching',
    message: !state.jobsHydrated
      ? 'ATS job matching is syncing with your candidate profile.'
      : state.matchedJobCount > 0
        ? 'New ATS job matches discovered from Greenhouse/Lever.'
        : 'No new Greenhouse/Lever matches yet. Matching remains active.',
    timestamp: jobsTimestamp,
    read: readSet.has(jobsId),
    type: state.matchedJobCount > 0 ? 'success' : 'info',
  };

  return [profileNotification, interviewNotification, jobsNotification];
}
