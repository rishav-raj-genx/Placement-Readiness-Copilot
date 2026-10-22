import { redirect } from 'next/navigation';
import { safeInternalPath } from '@/lib/auth-routing';

interface SignUpPageProps {
  searchParams: Promise<{
    redirectTo?: string;
    redirect?: string;
  }> | {
    redirectTo?: string;
    redirect?: string;
  };
}

export default async function SignUpPage({ searchParams }: SignUpPageProps): Promise<never> {
  const resolvedParams = await Promise.resolve(searchParams);
  const target = safeInternalPath(resolvedParams.redirect || resolvedParams.redirectTo);
  const query = new URLSearchParams({ mode: 'signup' });
  if (target) {
    query.set('redirectTo', target);
    query.set('redirect', target);
  }
  redirect(`/auth?${query.toString()}`);
}
