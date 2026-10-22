'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IntroSequence } from '@/components/IntroSequence';
import { useAuthStore } from '@/stores/auth-store';
import { isTourCompleted } from '@/lib/tour-storage';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const [showIntro, setShowIntro] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isHydrated) {
      hydrate();
    }
  }, [hydrate, isHydrated]);

  useEffect(() => {
    if (!mounted) return;

    // Gracefully handle unauthenticated first-time visitors
    const completed = isTourCompleted({
      userId: user?.id,
      onboardingCompletedAt: user?.onboardingCompletedAt,
    });

    if (completed) {
      router.replace('/dashboard');
    } else {
      setShowIntro(true);
    }
  }, [mounted, router, user]);

  if (!mounted) {
    return <div className="min-h-screen bg-[#1a1310]" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1a1310]">
      {showIntro && (
        <IntroSequence
          open={showIntro}
          onClose={() => {
            setShowIntro(false);
            router.replace('/dashboard');
          }}
        />
      )}
    </main>
  );
}
