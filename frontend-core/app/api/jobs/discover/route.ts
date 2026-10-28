import { NextRequest, NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { getAutomationBaseUrl, serviceRequest } from '@/lib/backend-services';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createServerSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('target_role,target_locations,skills,onboarding_completed_at')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: 'Complete your profile before discovering jobs.' },
        { status: 409 },
      );
    }

    // Read optional force_refresh flag from request body (sent after role change)
    let forceRefresh = false;
    try {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'force_refresh' in body) {
        forceRefresh = Boolean((body as Record<string, unknown>).force_refresh);
      }
    } catch {
      // Body may be empty — that's fine
    }

    const effectiveTargetRole =
      (profile.target_role as string | null)?.trim() || 'Full-Stack Software Engineer';

    const profileSkills = Array.isArray(profile.skills)
      ? (profile.skills as unknown[])
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
      : [];

    const targetLocations: string[] = Array.isArray(profile.target_locations)
      ? (profile.target_locations as unknown[]).filter(
          (l): l is string => typeof l === 'string' && l.trim().length > 0,
        )
      : [];

    // Always include India/Remote so JSearch has a location context
    const locations = targetLocations.length > 0 ? targetLocations : ['India', 'Remote'];

    const payload = await serviceRequest(`${getAutomationBaseUrl()}/api/discover-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: user.id,
        target_role: effectiveTargetRole,
        locations,
        skills: profileSkills,
        max_results: 20,
        force_refresh: forceRefresh,
      }),
      timeoutMs: 60_000,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Job discovery failed.' },
      { status: 502 },
    );
  }
}
