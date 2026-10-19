'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useInterviewStore } from '@/stores/interview-store';
import { LenisProvider } from '@/components/providers/lenis-provider';

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
    </LenisProvider>
  );
}

