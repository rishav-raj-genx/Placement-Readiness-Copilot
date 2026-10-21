import { NextRequest, NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';

export const runtime = 'nodejs';

interface CompleteSessionPayload {
  interviewId?: string;
  transcript?: unknown;
  codeHistory?: string;
  code_history?: string;
  vivaScores?: Record<string, unknown>;
  viva_scores?: Record<string, unknown>;
  result?: Record<string, unknown>;
  status?: string;
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

    const payload: unknown = await request.json().catch(() => null);
    const body: CompleteSessionPayload =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as CompleteSessionPayload)
        : {};

    const interviewId = typeof body.interviewId === 'string' ? body.interviewId.trim() : '';
    if (!interviewId) {
      return NextResponse.json({ error: 'interviewId is required.' }, { status: 400 });
    }

    const adminClient = createSupabaseServiceClient();

    // Verify session belongs to authenticated user or user is admin
    const { data: existingSession, error: fetchError } = await adminClient
      .from('interview_sessions')
      .select('id, user_id, student_id, target_role, config, code_history, transcript')
      .eq('id', interviewId)
      .maybeSingle();

    if (fetchError || !existingSession) {
      return NextResponse.json({ error: 'Interview session not found.' }, { status: 404 });
    }

    const sessionOwner = existingSession.user_id || existingSession.student_id;
    if (sessionOwner !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to modify this session.' }, { status: 403 });
    }

    // Prepare transcript JSON array
    let normalizedTranscript: unknown[] = [];
    if (Array.isArray(body.transcript)) {
      normalizedTranscript = body.transcript;
    } else if (typeof body.transcript === 'string') {
      try {
        const parsed = JSON.parse(body.transcript);
        if (Array.isArray(parsed)) normalizedTranscript = parsed;
        else normalizedTranscript = [{ speaker: 'student', text: body.transcript }];
      } catch {
        normalizedTranscript = [{ speaker: 'student', text: body.transcript }];
      }
    } else if (Array.isArray(existingSession.transcript) && existingSession.transcript.length > 0) {
      normalizedTranscript = existingSession.transcript;
    }

    // Code snapshot from Round 2
    const codeHistory = body.codeHistory?.trim() || body.code_history?.trim() || existingSession.code_history || null;

    // Granular viva scores with fallback
    const rawScores = body.vivaScores || body.viva_scores || (body.result ? body.result : {});
    const targetRole = existingSession.target_role || 'Software Engineer';

    const finalScore =
      typeof rawScores.interview_score === 'number'
        ? rawScores.interview_score
        : typeof rawScores.finalScore === 'number'
        ? rawScores.finalScore
        : typeof rawScores.overall_score === 'number'
        ? rawScores.overall_score
        : 72;

    const summary =
      typeof rawScores.summary === 'string' && rawScores.summary.trim()
        ? rawScores.summary.trim()
        : `Completed mock interview viva for ${targetRole}. Candidate addressed core concepts and technical trade-offs.`;

    const vivaScores = {
      interview_score: finalScore,
      summary,
      strengths: Array.isArray(rawScores.strengths) ? rawScores.strengths : ['Demonstrated fundamental knowledge in target domain'],
      improvement_areas: Array.isArray(rawScores.improvement_areas) ? rawScores.improvement_areas : ['Provide more quantified scale and latency benchmarks'],
      dimensions: rawScores.dimensions || {
        technical_depth: { score: finalScore, feedback: 'Strong foundational understanding' },
        communication: { score: Math.min(100, finalScore + 4), feedback: 'Clear articulation' },
        behavioral: { score: Math.min(100, finalScore + 2), feedback: 'Professional structured responses' },
      },
    };

    const finalResult = {
      contract_version: '2.0.0',
      interview_score: finalScore,
      summary,
      strengths: vivaScores.strengths,
      improvement_areas: vivaScores.improvement_areas,
      transcript: normalizedTranscript,
      dimensions: vivaScores.dimensions,
      code_history: codeHistory,
    };

    // Deep state saving: strictly update status to 'completed'
    const { error: updateError } = await adminClient
      .from('interview_sessions')
      .update({
        status: 'completed',
        transcript: normalizedTranscript,
        code_history: codeHistory,
        viva_scores: vivaScores,
        result: finalResult,
        completed_at: new Date().toISOString(),
      })
      .eq('id', interviewId);

    if (updateError) {
      console.error('[Session Complete] Database update failed:', updateError);
      return NextResponse.json({ error: 'Failed to update interview session.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      interviewId,
      status: 'completed',
      finalScore,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error completing session';
    console.error('[Session Complete] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
