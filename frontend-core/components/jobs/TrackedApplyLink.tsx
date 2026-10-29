'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useApplicationStore } from '@/stores/application-store';
import { useAuthStore } from '@/stores/auth-store';

interface TrackedApplyLinkProps {
  jobId: string;
  company: string;
  jobTitle: string;
  url: string;
  className?: string;
  children: ReactNode;
}

export function TrackedApplyLink({
  jobId,
  company,
  jobTitle,
  url,
  className,
  children,
}: TrackedApplyLinkProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const addApplication = useApplicationStore((state) => state.addApplication);
  const [isTracking, setIsTracking] = useState(false);

  const trackApplication = async (): Promise<void> => {
    if (!user || isTracking) return;
    setIsTracking(true);

    try {
      await addApplication({
        userId: user.id,
        jobId,
        company,
        jobTitle,
        status: 'applied',
        applicationDate: new Date().toISOString().slice(0, 10),
        jobPostingUrl: url,
      });
      toast.success(`Application recorded for ${company}! Practice tailored interview questions now.`, {
        action: {
          label: 'Practice Interview',
          onClick: () => router.push(`/dashboard/interview?role=${encodeURIComponent(jobTitle)}&company=${encodeURIComponent(company)}&jobId=${encodeURIComponent(jobId)}`),
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to record this application.';
      toast.error(message);
    } finally {
      setIsTracking(false);
    }
  };

  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!user) {
      event.preventDefault();
      router.push('/auth');
      return;
    }
    if (isTracking) {
      event.preventDefault();
      return;
    }
    void trackApplication();
  };

  return (
    <a
      href={user ? url : '/auth'}
      target={user ? '_blank' : undefined}
      rel={user ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
      aria-busy={isTracking}
      className={cn(className, isTracking && 'pointer-events-none opacity-70')}
    >
      {children}
    </a>
  );
}
