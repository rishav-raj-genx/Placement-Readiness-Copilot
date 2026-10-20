import { NextRequest, NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { getAutomationBaseUrl, serviceRequest } from '@/lib/backend-services';
import { normalizeUserProfile, PROFILE_SELECT_COLUMNS } from '@/lib/profile-adapters';

interface ProjectCheckBody { projectId?: string; }

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null) as ProjectCheckBody | null;
    if (!body?.projectId) return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
    const supabase = createServerSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).eq('id', user.id).single();
    const profile = normalizeUserProfile(data as unknown);
    const project = profile?.projects.find((item) => item.id === body.projectId);
    if (!project?.liveUrl) return NextResponse.json({ error: 'This owned project has no live URL.' }, { status: 404 });
    const payload = await serviceRequest(`${getAutomationBaseUrl()}/api/link-check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: project.liveUrl, student_id: user.id, project_name: project.name, claimed_keywords: profile?.skills ?? [] }),
      timeoutMs: 45_000,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Project check failed.' }, { status: 502 });
  }
}
