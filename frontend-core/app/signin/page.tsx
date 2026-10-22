import { redirect } from 'next/navigation';
import { safeInternalPath } from '@/lib/auth-routing';

interface SignInPageProps {
  searchParams: Promise<{
    redirectTo?: string;
    redirect?: string;
  }> | {
    redirectTo?: string;
    redirect?: string;
  };
}

export default async function SignInPage({ searchParams }: SignInPageProps): Promise<never> {
  const resolvedParams = await Promise.resolve(searchParams);
  const target = safeInternalPath(resolvedParams.redirect || resolvedParams.redirectTo);
  const query = new URLSearchParams({ mode: 'login' });
  if (target) {
    query.set('redirectTo', target);
    query.set('redirect', target);
  }
  redirect(`/auth?${query.toString()}`);
}
