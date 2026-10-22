'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeInternalPath } from '@/lib/auth-routing';

function SignUpRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = safeInternalPath(searchParams.get('redirect') || searchParams.get('redirectTo'));
    const query = new URLSearchParams({ mode: 'signup' });
    if (target) {
      query.set('redirectTo', target);
      query.set('redirect', target);
    }
    router.replace(`/auth?${query.toString()}`);
  }, [router, searchParams]);

  return <div className="min-h-screen bg-[#1a1310]" />;
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1310]" />}>
      <SignUpRedirect />
    </Suspense>
  );
}
