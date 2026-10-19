import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedDestination, safeInternalPath } from '@/lib/auth-routing';
import { createServerSessionClient } from '@/lib/supabase-session-server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const requestedPath = safeInternalPath(request.nextUrl.searchParams.get('next'));
  if (!code) return NextResponse.redirect(new URL('/auth?error=missing_code', request.url));

  try {
    const supabase = createServerSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Confirmation did not create a session.');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    const destination = getAuthenticatedDestination({
      role: profile?.role === 'admin' ? 'admin' : 'student',
      onboardingCompleted: Boolean(profile?.onboarding_completed_at),
      requestedPath,
    });
    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return NextResponse.redirect(new URL('/auth?error=confirmation_failed', request.url));
  }
}
