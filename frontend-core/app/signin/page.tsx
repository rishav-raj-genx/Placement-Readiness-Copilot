import { redirect } from 'next/navigation';
import { safeInternalPath } from '@/lib/auth-routing';

interface SignInPageProps {
  searchParams: {
    redirectTo?: string;
  };
}

export default function SignInPage({ searchParams }: SignInPageProps): never {
  const redirectTo = safeInternalPath(searchParams.redirectTo);
  const query = new URLSearchParams({ mode: 'login' });
  if (redirectTo) query.set('redirectTo', redirectTo);
  redirect(`/auth?${query.toString()}`);
}
