import { NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { getAutomationBaseUrl, serviceRequest } from '@/lib/backend-services';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = createServerSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile, error } = await supabase.from('profiles').select('target_role,target_locations,skills,onboarding_completed_at').eq('id', user.id).single();
    if (error || !profile?.onboarding_completed_at) return NextResponse.json({ error: 'Complete onboarding before discovering jobs.' }, { status: 409 });
    const payload = await serviceRequest(`${getAutomationBaseUrl()}/api/discover-jobs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_role: profile.target_role, locations: profile.target_locations ?? [], skills: profile.skills ?? [], max_results: 20 }),
      timeoutMs: 45_000,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Job discovery failed.' }, { status: 502 });
  }
}
