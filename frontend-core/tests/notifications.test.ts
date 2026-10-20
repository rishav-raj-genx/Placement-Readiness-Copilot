import { describe, expect, it } from 'vitest';

import { buildNotificationFeed } from '@/lib/notifications';

const feedState = {
  userId: 'student-1',
  targetRole: 'SDE',
  profileStatus: 'completed' as const,
  readinessScore: 84,
  profileUpdatedAt: '2026-10-20T10:00:00.000Z',
  remainingInterviews: 3,
  interviewUpdatedAt: '2026-10-20T11:00:00.000Z',
  matchedJobCount: 4,
  jobsHydrated: true,
  latestJobId: 'job-4',
  jobsUpdatedAt: '2026-10-20T12:00:00.000Z',
};

describe('notification feed', () => {
  it('builds milestone notifications from live workspace state', () => {
    const notifications = buildNotificationFeed(feedState, []);

    expect(notifications).toHaveLength(3);
    expect(notifications[0].message).toContain('Readiness score updated');
    expect(notifications[1].message).toBe('3 Mock interview credits available for SDE track.');
    expect(notifications[2].message).toBe('New ATS job matches discovered from Greenhouse/Lever.');
    expect(notifications.every((notification) => !notification.read)).toBe(true);
  });

  it('marks persisted notification IDs as read', () => {
    const initial = buildNotificationFeed(feedState, []);
    const notifications = buildNotificationFeed(feedState, initial.map((item) => item.id));

    expect(notifications.every((notification) => notification.read)).toBe(true);
  });

  it('does not claim matches before the jobs feed is hydrated', () => {
    const notifications = buildNotificationFeed({
      ...feedState,
      matchedJobCount: 0,
      jobsHydrated: false,
    }, []);

    expect(notifications[2].message).toContain('syncing');
  });
});
