/**
 * POST /api/jobs/invalidate
 *
 * Called when a student saves a new target_role on their profile.
 * Deletes all previously discovered jobs scoped to that student so the
 * next visit to the jobs page triggers a fresh JSearch query with the
 * new role and location context. Never deletes official MSOT posts.
 */
import { NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = createServerSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the service role client to bypass RLS for the delete
    const serviceClient = createSupabaseServiceClient();
    const { error } = await serviceClient
      .from('discovered_jobs')
      .delete()
      .eq('student_id', user.id)
      .eq('is_msot_post', false); // Never delete official MSOT posts

    if (error) {
      // Non-fatal — stale jobs are better than an error blocking profile save
      console.warn('[invalidate-jobs] Supabase delete warning:', error.message);
    }

    return NextResponse.json({ success: true, studentId: user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to invalidate job cache.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

