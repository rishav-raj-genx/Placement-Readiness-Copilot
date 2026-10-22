'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCanvas } from '@/components/auth/AuthCanvas';
import { safeInternalPath } from '@/lib/auth-routing';

function SignUpPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = safeInternalPath(searchParams.get('redirectTo') || searchParams.get('redirect'));

  return <AuthCanvas initialMode="signup" redirectTo={redirectTo} />;
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1310]" />}>
      <SignUpPageContent />
    </Suspense>
  );
}
