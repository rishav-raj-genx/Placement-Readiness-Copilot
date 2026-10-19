import { redirect } from 'next/navigation';
import { safeInternalPath } from '@/lib/auth-routing';

interface SignUpPageProps {
  searchParams: {
    redirectTo?: string;
  };
}

export default function SignUpPage({ searchParams }: SignUpPageProps): never {
  const redirectTo = safeInternalPath(searchParams.redirectTo);
  const query = new URLSearchParams({ mode: 'signup' });
  if (redirectTo) query.set('redirectTo', redirectTo);
  redirect(`/auth?${query.toString()}`);
}
