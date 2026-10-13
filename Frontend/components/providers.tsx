'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useInterviewStore } from '@/stores/interview-store';
import { useApplicationStore } from '@/stores/application-store';
import { useJobStore } from '@/stores/job-store';
import { useChatStore } from '@/stores/chat-store';
import { OrangeCursor } from '@/components/shared/orange-cursor';
import { LenisProvider } from '@/components/providers/lenis-provider';

import { AuthModal } from '@/components/auth-modal';

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateInterview = useInterviewStore((s) => s.hydrate);
  const hydrateApplications = useApplicationStore((s) => s.hydrate);
  const hydrateJobs = useJobStore((s) => s.hydrate);
  const hydrateChat = useChatStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateInterview();
    hydrateApplications();
    hydrateJobs();
    hydrateChat();
  }, [hydrateAuth, hydrateInterview, hydrateApplications, hydrateJobs, hydrateChat]);

  return (
    <LenisProvider>
      {children}
      <AuthModal />
      <OrangeCursor />
    </LenisProvider>
  );
}

