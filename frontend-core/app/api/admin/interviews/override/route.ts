import { NextRequest, NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';

export const runtime = 'nodejs';

interface OverrideRequestBody {
  interviewId?: string;
  score?: number;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSessionClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Your session is invalid or expired.' }, { status: 401 });
    }

    const adminClient = createSupabaseServiceClient();

    // Verify admin role
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, display_name, email')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Faculty admin access required.' }, { status: 403 });
    }

    const payload: unknown = await request.json().catch(() => null);
    const body: OverrideRequestBody =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as OverrideRequestBody)
        : {};

    const interviewId = typeof body.interviewId === 'string' ? body.interviewId.trim() : '';
    const score = typeof body.score === 'number' ? body.score : Number(body.score);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!interviewId) {
      return NextResponse.json({ error: 'interviewId is required.' }, { status: 400 });
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: 'Score must be a number between 0 and 100.' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: 'Reason for override is required.' }, { status: 400 });
    }

    const facultyName = profile.display_name || profile.email?.split('@')[0] || 'MSOT Staff';

    // Update interview_sessions with admin_score and admin_feedback
    const { data: existingSession, error: fetchSessionError } = await adminClient
      .from('interview_sessions')
      .select('id, interview_score, viva_scores, result')
      .eq('id', interviewId)
      .maybeSingle();

    if (fetchSessionError || !existingSession) {
      return NextResponse.json({ error: 'Interview session not found.' }, { status: 404 });
    }

    const aiScore =
      typeof existingSession.interview_score === 'number'
        ? existingSession.interview_score
        : existingSession.result?.interview_score || existingSession.viva_scores?.interview_score || score;

    const { error: updateError } = await adminClient
      .from('interview_sessions')
      .update({
        admin_score: Math.round(score * 100) / 100,
        admin_feedback: reason,
        admin_scored_by: user.id,
        admin_scored_by_name: facultyName,
        admin_scored_at: new Date().toISOString(),
        original_ai_score: aiScore,
        score_override_reason: reason,
        score_overridden_by: user.id,
        score_overridden_by_name: facultyName,
        score_overridden_at: new Date().toISOString(),
      })
      .eq('id', interviewId);

    if (updateError) {
      console.error('[Admin Override] Failed to update session:', updateError);
      return NextResponse.json({ error: 'Failed to update interview score.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      interviewId,
      adminScore: score,
      adminFeedback: reason,
      facultyName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown override error';
    console.error('[Admin Override] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
