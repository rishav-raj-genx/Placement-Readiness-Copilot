'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCanvas } from '@/components/auth/AuthCanvas';

function AuthPageContent() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const redirectTo = searchParams.get('redirectTo');
  const initialMode = modeParam === 'signup' ? 'signup' : 'login';

  return <AuthCanvas initialMode={initialMode} redirectTo={redirectTo} />;
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1310]" />}>
      <AuthPageContent />
    </Suspense>
  );
}
