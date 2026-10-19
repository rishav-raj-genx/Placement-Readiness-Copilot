'use client';

import React, { Suspense } from 'react';
import { AuthCanvas } from '@/components/auth/AuthCanvas';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0F17]" />}>
      <AuthCanvas initialMode="signup" />
    </Suspense>
  );
}
