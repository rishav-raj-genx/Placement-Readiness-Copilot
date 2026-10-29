import { NextRequest, NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { getOptionalAutomationBaseUrl, serviceRequest } from '@/lib/backend-services';
import { discoverAndCacheJobs } from '@/lib/jsearch-service';

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

    // Primary path: Query automation discovery service if configured
    const automationBase = getOptionalAutomationBaseUrl();
    if (automationBase) {
      try {
        const payload = await serviceRequest(`${automationBase}/api/discover-jobs`, {
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
          timeoutMs: 25_000,
        });

        const payloadRecord = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
        const discoveredList = payloadRecord && Array.isArray(payloadRecord.jobs) ? payloadRecord.jobs : [];
        if (discoveredList.length > 0) {
          return NextResponse.json(payload);
        }
      } catch (automationErr) {
        console.warn('Automation service unreachable or timed out; proceeding with direct JSearch engine:', automationErr);
      }
    }

    // Secondary path: Direct JSearch engine with automatic Supabase caching
    try {
      const freshJobs = await discoverAndCacheJobs({
        supabase,
        studentId: user.id,
        targetRole: effectiveTargetRole,
        skills: profileSkills,
        locations,
        forceRefresh,
      });

      if (freshJobs.length > 0) {
        return NextResponse.json({
          count: freshJobs.length,
          jobs: freshJobs,
          freshness: { source: 'jsearch_direct' },
        });
      }
    } catch (directJSearchErr) {
      console.warn('Direct JSearch call failed:', directJSearchErr);
    }

    // Tertiary path: Return existing published jobs from Supabase
    const { data: cachedDbJobs } = await supabase
      .from('discovered_jobs')
      .select('*')
      .eq('publication_status', 'published')
      .order('relevance_score', { ascending: false })
      .limit(20);

    return NextResponse.json({
      count: cachedDbJobs?.length ?? 0,
      jobs: cachedDbJobs ?? [],
      freshness: { source: 'supabase_cache' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Job discovery failed.' },
      { status: 502 },
    );
  }
}
