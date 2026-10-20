'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCheck, CircleCheck, Info } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildNotificationFeed, type NotificationItem } from '@/lib/notifications';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { useInterviewStore } from '@/stores/interview-store';
import { useJobStore } from '@/stores/job-store';
import { useProfileStore } from '@/stores/profile-store';

const READ_NOTIFICATIONS_KEY = 'notification-read-ids';

function formatRelativeTime(timestamp: string, now: number | null): string {
  if (now === null) return 'Recent';
  const eventTime = Date.parse(timestamp);
  if (Number.isNaN(eventTime) || eventTime === 0) return 'Recent';
  const minutes = Math.max(0, Math.floor((now - eventTime) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationTypeIcon({ type }: Pick<NotificationItem, 'type'>) {
  if (type === 'success') return <CircleCheck className="h-4 w-4 text-emerald-400" />;
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Info className="h-4 w-4 text-[#D93829]" />;
}

export function NotificationBell() {
  const profile = useProfileStore((state) => state.profile);
  const review = useProfileStore((state) => state.review);
  const readiness = useProfileStore((state) => state.readiness);
  const sessions = useInterviewStore((state) => state.sessions);
  const remainingInterviews = useInterviewStore((state) => state.getRemainingCount());
  const matchedJobs = useJobStore((state) => state.matchedJobs);
  const jobsHydrated = useJobStore((state) => state.isHydrated);
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setReadIds(loadFromStorage<string[]>(READ_NOTIFICATIONS_KEY, []));
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const latestInterviewAt = useMemo(() => {
    const latest = [...sessions].sort((left, right) => (
      Date.parse(right.completedAt ?? right.createdAt) - Date.parse(left.completedAt ?? left.createdAt)
    ))[0];
    return latest?.completedAt ?? latest?.createdAt;
  }, [sessions]);

  const latestJob = useMemo(() => {
    return [...matchedJobs].sort((left, right) => (
      Date.parse(right.postedAt ?? right.createdAt) - Date.parse(left.postedAt ?? left.createdAt)
    ))[0];
  }, [matchedJobs]);

  const notifications = useMemo(() => buildNotificationFeed({
    userId: profile?.id ?? null,
    targetRole: profile?.targetRole,
    profileStatus: review?.status,
    readinessScore: readiness?.totalScore,
    profileUpdatedAt: readiness?.updatedAt ?? review?.updatedAt ?? profile?.updatedAt ?? profile?.createdAt,
    remainingInterviews,
    interviewUpdatedAt: latestInterviewAt,
    matchedJobCount: matchedJobs.length,
    jobsHydrated,
    latestJobId: latestJob?.id,
    jobsUpdatedAt: latestJob?.postedAt ?? latestJob?.updatedAt ?? latestJob?.createdAt,
  }, readIds), [
    jobsHydrated,
    latestInterviewAt,
    latestJob,
    matchedJobs.length,
    profile,
    readiness,
    readIds,
    remainingInterviews,
    review,
  ]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAllAsRead = (): void => {
    const nextReadIds = Array.from(new Set([
      ...readIds,
      ...notifications.map((notification) => notification.id),
    ])).slice(-100);
    setReadIds(nextReadIds);
    saveToStorage(READ_NOTIFICATIONS_KEY, nextReadIds);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-4 w-4 text-stone-300" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#D93829]" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] overflow-hidden border border-stone-800 bg-stone-900 p-0 shadow-2xl backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-stone-100">Notifications</p>
              <p className="text-[11px] text-stone-400">{unreadCount} unread update{unreadCount === 1 ? '' : 's'}</p>
            </div>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-stone-300 transition-colors hover:bg-stone-800 hover:text-stone-100 disabled:cursor-default disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </button>
          </div>

          <div className="max-h-[22rem] overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-stone-500">Workspace updates will appear here.</p>
            ) : notifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative flex gap-3 rounded-xl px-3 py-3 transition-colors ${notification.read ? 'opacity-60' : 'bg-stone-800/40'}`}
              >
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-stone-800 bg-stone-800">
                  <NotificationTypeIcon type={notification.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-stone-200">{notification.title}</p>
                    {!notification.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D93829]" />}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-stone-400">{notification.message}</p>
                  <time dateTime={notification.timestamp} className="mt-1.5 block text-[10px] text-stone-500">
                    {formatRelativeTime(notification.timestamp, now)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
