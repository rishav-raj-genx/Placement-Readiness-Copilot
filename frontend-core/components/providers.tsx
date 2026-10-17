'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useInterviewStore } from '@/stores/interview-store';
import { OrangeCursor } from '@/components/shared/orange-cursor';
import { LenisProvider } from '@/components/providers/lenis-provider';

import { AuthModal } from '@/components/auth-modal';

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateInterview = useInterviewStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateInterview();
  }, [hydrateAuth, hydrateInterview]);

  return (
    <LenisProvider>
      {children}
      <AuthModal />
      <OrangeCursor />
    </LenisProvider>
  );
}

