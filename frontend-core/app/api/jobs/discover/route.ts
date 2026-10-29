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

    // Primary path: Query automation discovery service
    try {
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
        timeoutMs: 30_000,
      });

      const payloadRecord = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null;
      const discoveredList = Array.isArray(payloadRecord?.jobs) ? payloadRecord.jobs : [];
      if (discoveredList.length > 0) {
        return NextResponse.json(payload);
      }
    } catch (automationErr) {
      console.warn('Automation service unreachable or timed out; trying direct JSearch / Supabase fallback:', automationErr);
    }

    // Secondary path: Direct JSearch API invocation if key is configured in this deployment
    const jsearchKey = (process.env.JSEARCH_API_KEY || process.env.RAPIDAPI_KEY || '').trim();
    if (jsearchKey && jsearchKey !== 'YOUR_RAPIDAPI_KEY_HERE') {
      try {
        const primaryLocation = locations[0] || 'India';
        const jsearchQuery = `${effectiveTargetRole} in ${primaryLocation}`;
        const jsearchUrl = new URL('https://jsearch.p.rapidapi.com/search-v2');
        jsearchUrl.searchParams.set('query', jsearchQuery);
        jsearchUrl.searchParams.set('num_pages', '1');
        jsearchUrl.searchParams.set('date_posted', 'month');

        const roleLower = effectiveTargetRole.toLowerCase();
        if (roleLower.includes('intern') || roleLower.includes('trainee')) {
          jsearchUrl.searchParams.set('employment_types', 'INTERN');
        } else {
          jsearchUrl.searchParams.set('employment_types', 'FULLTIME,CONTRACTOR');
        }

        const jsearchRes = await fetch(jsearchUrl.toString(), {
          headers: {
            'X-RapidAPI-Key': jsearchKey,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
          cache: 'no-store',
        });

        if (jsearchRes.ok) {
          const jsearchJson = (await jsearchRes.json()) as Record<string, unknown>;
          const rawJobs = Array.isArray((jsearchJson.data as Record<string, unknown>)?.jobs)
            ? ((jsearchJson.data as Record<string, unknown>).jobs as Array<Record<string, unknown>>)
            : [];

          if (rawJobs.length > 0) {
            const formattedJobs = rawJobs.map((raw) => {
              const rawId = String(raw.job_id || Math.random().toString(36).slice(2));
              const title = String(raw.job_title || 'Software Engineer');
              const company = String(raw.employer_name || 'Technology Company');
              const applyLink = String(raw.job_apply_link || '');
              const isRemote = Boolean(raw.job_is_remote);
              const city = String(raw.job_city || '');
              const country = String(raw.job_country || '');
              const location = isRemote ? 'Remote' : ([city, country].filter(Boolean).join(', ') || 'India / Remote');

              const isIntern = roleLower.includes('intern') || title.toLowerCase().includes('intern');
              const empType = isIntern ? 'internship' : 'full_time';

              const highlights = (raw.job_highlights as Record<string, unknown>) || {};
              const qualifications = Array.isArray(highlights.Qualifications)
                ? (highlights.Qualifications as string[])
                : [];

              return {
                id: `jsearch_${rawId.slice(0, 16)}`,
                student_id: user.id,
                title,
                company,
                location,
                url: applyLink,
                source: 'jsearch_api',
                description: String(raw.job_description || '').slice(0, 2000),
                required_skills: qualifications.slice(0, 5),
                matched_skills: profileSkills.filter((s) =>
                  String(raw.job_description || '').toLowerCase().includes(s.toLowerCase()),
                ),
                relevance_score: 85,
                match_reason: `Matched via JSearch for '${effectiveTargetRole}'`,
                is_remote: isRemote,
                job_type: isIntern ? 'internship/entry-level' : 'full_time',
                employment_type: empType,
                publication_status: 'published',
                posted_at: String(raw.job_posted_at_datetime_utc || new Date().toISOString()),
              };
            });

            // Upsert into Supabase for instant caching
            try {
              await supabase
                .from('discovered_jobs')
                .upsert(formattedJobs, { onConflict: 'url' });
            } catch (saveErr) {
              console.warn('Failed to cache direct JSearch jobs into Supabase:', saveErr);
            }

            return NextResponse.json({
              count: formattedJobs.length,
              jobs: formattedJobs,
              freshness: { source: 'jsearch_direct' },
            });
          }
        }
      } catch (directJSearchErr) {
        console.warn('Direct JSearch call failed:', directJSearchErr);
      }
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
