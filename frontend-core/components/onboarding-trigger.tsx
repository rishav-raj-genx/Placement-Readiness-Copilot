'use client';

import { useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useAuthStore } from '@/stores/auth-store';
import { OnboardingModal } from '@/components/onboarding-modal';

interface OnboardingTriggerProps {
  autoOpen?: boolean;
}

export function OnboardingTrigger({ autoOpen = true }: OnboardingTriggerProps) {
  const { isHydrated: authHydrated, user } = useAuthStore();
  const { isOpen, checkAndAutoOpen, hasChecked } = useOnboardingStore();
  const lastCheckedUserId = useRef<string | null | undefined | '__uninit__'>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (!authHydrated) return;
    if (!autoOpen) return;

    const currentUserId = user?.id ?? null;

    if (isFirstMount.current) {
      isFirstMount.current = false;
      lastCheckedUserId.current = currentUserId;
      checkAndAutoOpen(currentUserId);
      return;
    }

    if (lastCheckedUserId.current !== currentUserId) {
      lastCheckedUserId.current = currentUserId;
      useOnboardingStore.setState({ hasChecked: false });
      checkAndAutoOpen(currentUserId);
    }
  }, [authHydrated, user, autoOpen, checkAndAutoOpen, hasChecked]);

  return <OnboardingModal />;
}
