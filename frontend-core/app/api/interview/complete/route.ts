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

    // PHASE 3: MASTER SCORE RECALCULATION
    let newMockScore = Math.round(finalScore);
    let ideScore: number | null = null;
    const vivaScore = Math.round(finalScore);

    try {
      // Find latest completed Round 2 (IDE / coding) session to aggregate
      const { data: recentSessions } = await adminClient
        .from('interview_sessions')
        .select('interview_score, viva_scores, result, config')
        .or(`user_id.eq.${user.id},student_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (Array.isArray(recentSessions)) {
        const codingSession = recentSessions.find((s) => {
          const cfg = typeof s.config === 'object' && s.config !== null ? (s.config as Record<string, unknown>) : {};
          return cfg.type === 'coding' || cfg.round === 2;
        });

        if (codingSession) {
          const vivaRec = typeof codingSession.viva_scores === 'object' && codingSession.viva_scores !== null
            ? (codingSession.viva_scores as Record<string, unknown>)
            : {};
          const resultRec = typeof codingSession.result === 'object' && codingSession.result !== null
            ? (codingSession.result as Record<string, unknown>)
            : {};
          const codingRec = typeof resultRec.coding_result === 'object' && resultRec.coding_result !== null
            ? (resultRec.coding_result as Record<string, unknown>)
            : {};

          const rawIde =
            codingSession.interview_score ??
            vivaRec.overall_score ??
            vivaRec.ide_score ??
            codingRec.overall_score ??
            resultRec.interview_score;

          if (typeof rawIde === 'number' && Number.isFinite(rawIde)) {
            ideScore = Math.round(rawIde);
          }
        }
      }

      newMockScore = ideScore !== null
        ? Math.round((vivaScore + ideScore) / 2)
        : vivaScore;

      // Update profiles.scores JSON
      const studentId = user.id;
      const { data: profileData } = await adminClient
        .from('profiles')
        .select('scores')
        .eq('id', studentId)
        .maybeSingle();

      type ProfileScoresPayload = Record<string, unknown> & {
        resume?: number;
        projects?: number;
        mock_interview?: number;
        github?: number;
        linkedin?: number;
        leetcode?: number;
        coding_practice?: number;
      };

      const currentScores: ProfileScoresPayload = (profileData?.scores && typeof profileData.scores === 'object' && !Array.isArray(profileData.scores))
        ? (profileData.scores as ProfileScoresPayload)
        : {};

      const updatedScores: ProfileScoresPayload = {
        ...currentScores,
        mock_interview: newMockScore,
      };

      await adminClient
        .from('profiles')
        .update({
          scores: updatedScores,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId);

      // Synchronize readiness_scores table if present
      const { data: existingReadiness } = await adminClient
        .from('readiness_scores')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (existingReadiness) {
        const resumeScore = typeof updatedScores.resume === 'number' ? updatedScores.resume : 0;
        const projectsScore = typeof updatedScores.projects === 'number' ? updatedScores.projects : 0;
        const githubScore = typeof updatedScores.github === 'number' ? updatedScores.github : 0;
        const linkedinScore = typeof updatedScores.linkedin === 'number' ? updatedScores.linkedin : 0;
        const leetcodeScore = typeof updatedScores.leetcode === 'number'
          ? updatedScores.leetcode
          : (typeof updatedScores.coding_practice === 'number' ? updatedScores.coding_practice : 0);
        const leetcodeContribution = Math.min(10, Math.max(0, leetcodeScore * 0.10));

        const newTotalReadiness = Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (resumeScore * 0.25) +
              (projectsScore * 0.20) +
              (newMockScore * 0.20) +
              (githubScore * 0.15) +
              (linkedinScore * 0.10) +
              leetcodeContribution
            )
          )
        );

        const newReadinessLevel = newTotalReadiness >= 75
          ? 'Placement ready'
          : newTotalReadiness >= 50
            ? 'Almost ready'
            : 'Not ready';

        const rawInputs = typeof existingReadiness.raw_inputs === 'object' && existingReadiness.raw_inputs !== null
          ? (existingReadiness.raw_inputs as Record<string, unknown>)
          : {};

        const existingBreakdown = typeof existingReadiness.breakdown === 'object' && existingReadiness.breakdown !== null
          ? (existingReadiness.breakdown as Record<string, unknown>)
          : {};

        const updatedBreakdown = {
          ...existingBreakdown,
          mock_interview: {
            raw_score: newMockScore,
            weight: 0.20,
            weighted_points: Math.round(newMockScore * 0.20 * 10) / 10,
            max_points: 20,
            present: newMockScore > 0,
          },
        };

        await adminClient
          .from('readiness_scores')
          .update({
            total_score: newTotalReadiness,
            readiness_level: newReadinessLevel,
            breakdown: updatedBreakdown,
            raw_inputs: {
              ...rawInputs,
              scores: updatedScores,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('student_id', studentId);
      }
    } catch (scoreRecalcErr) {
      console.warn('[Session Complete] Master score recalculation notice:', scoreRecalcErr);
    }

    return NextResponse.json({
      success: true,
      interviewId,
      status: 'completed',
      finalScore,
      vivaScore,
      ideScore,
      newMockScore,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error completing session';
    console.error('[Session Complete] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
