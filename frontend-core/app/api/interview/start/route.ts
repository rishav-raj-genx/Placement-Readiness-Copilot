import { NextRequest, NextResponse } from 'next/server';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { randomUUID } from 'crypto';

import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';
import type { Difficulty, ExperienceLevel, CompanyType } from '@/types';

type InterviewMode = 'voice' | 'text';
type InterviewProvider = 'cloud_api' | 'ollama_local';

export const runtime = 'nodejs';

interface SessionStartPayload {
  studentId?: string;
  targetRole?: string;
  jobId?: string;
  resumeId?: string;
  topics?: string[];
  focusAreas?: string[];
  difficulty?: Difficulty;
  durationMinutes?: number;
  experienceLevel?: ExperienceLevel;
  companyType?: CompanyType;
  targetCompany?: string;
  customInstructions?: string;
  mode?: InterviewMode;
  provider?: InterviewProvider;
}

function isValidLiveKitUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'wss:' || protocol === 'ws:';
  } catch {
    return false;
  }
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
    const body: SessionStartPayload =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as SessionStartPayload)
        : {};

    const targetRole = typeof body.targetRole === 'string' ? body.targetRole.trim() : '';
    if (!targetRole) {
      return NextResponse.json({ error: 'targetRole is required.' }, { status: 400 });
    }

    const difficulty: Difficulty =
      body.difficulty === 'easy' || body.difficulty === 'medium' || body.difficulty === 'hard' || body.difficulty === 'adaptive'
        ? body.difficulty
        : 'medium';

    const experienceLevel: ExperienceLevel =
      body.experienceLevel === 'internship' || body.experienceLevel === 'entry_level' || body.experienceLevel === 'one_to_three' || body.experienceLevel === 'three_plus'
        ? body.experienceLevel
        : 'entry_level';

    const durationMinutes = body.durationMinutes === 20 ? 20 : 15;
    const focusTopics = Array.isArray(body.focusAreas ?? body.topics)
      ? Array.from(
          new Set(
            (body.focusAreas ?? body.topics ?? [])
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ).slice(0, 8)
      : [];

    const mode = body.mode === 'text' ? 'text' : 'voice';
    const provider = body.provider === 'ollama_local' ? 'ollama_local' : 'cloud_api';

    const adminClient = createSupabaseServiceClient();

    // ── 1. Check Profile Entitlements & Credits ──────────────────────────────
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, display_name, target_role, skills, github_username, interview_credits, is_premium')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'A candidate profile is required before starting an interview.' },
        { status: 409 },
      );
    }

    const isPremium = profile.is_premium === true;
    const availableCredits = typeof profile.interview_credits === 'number'
      ? profile.interview_credits
      : 3;

    // Check lifetime interview count from interview_sessions
    const { count: sessionCount, error: countError } = await adminClient
      .from('interview_sessions')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${user.id},student_id.eq.${user.id}`);

    if (countError) {
      console.warn('[Interview Start] Failed to query interview_sessions count:', countError);
    }

    const totalSessions = typeof sessionCount === 'number' ? sessionCount : 0;

    if (!isPremium && (totalSessions >= 3 || availableCredits <= 0)) {
      return NextResponse.json(
        {
          error: 'Free tier limit reached. You have completed your 3 free mock interviews.',
          code: 'LIMIT_EXCEEDED',
          count: totalSessions,
          limit: 3,
        },
        { status: 403 },
      );
    }

    // ── 2. Build Session Identifiers & Configuration ────────────────────────
    const sessionUuid = randomUUID();
    const interviewId = `intv_${sessionUuid}`;
    const roomName = `interview_${user.id}_${sessionUuid.slice(0, 8)}`;

    const sessionConfig = {
      targetRole,
      experienceLevel,
      topics: focusTopics,
      focusAreas: focusTopics,
      durationMinutes,
      difficulty,
      companyType: body.companyType || 'other',
      targetCompany: body.targetCompany?.trim() || undefined,
      customInstructions: body.customInstructions?.trim() || undefined,
      mode,
      provider,
    };

    const studentInfo = {
      id: user.id,
      name: profile.display_name || user.email?.split('@')[0] || 'Student',
      email: user.email || '',
      targetRole,
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      githubUsername: profile.github_username || '',
    };

    const roomMetadata = {
      interviewId,
      student: studentInfo,
      targetRole,
      focusAreas: focusTopics,
      difficulty,
      experienceLevel,
      durationMinutes,
      target_duration_minutes: durationMinutes,
      config: sessionConfig,
      mode,
      provider,
    };

    // ── 3. Insert Interview Session Record ──────────────────────────────────
    const { error: insertError } = await adminClient
      .from('interview_sessions')
      .insert({
        id: interviewId,
        user_id: user.id,
        student_id: user.id,
        livekit_room_name: roomName,
        target_role: targetRole,
        job_id: body.jobId || null,
        resume_id: body.resumeId || null,
        config: sessionConfig,
        room_metadata: roomMetadata,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[Interview Start] Failed to insert session:', insertError);
      return NextResponse.json(
        { error: 'Failed to create interview session record.' },
        { status: 500 },
      );
    }

    // ── 4. Generate LiveKit Token & Deduct Credit ───────────────────────────
    const rawApiKey = process.env.LIVEKIT_API_KEY?.trim() || '';
    const rawApiSecret = process.env.LIVEKIT_API_SECRET?.trim() || '';
    const wsUrl = (process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || '').trim();

    let token = '';
    if (rawApiKey && rawApiSecret && isValidLiveKitUrl(wsUrl)) {
      try {
        const roomService = new RoomServiceClient(wsUrl, rawApiKey, rawApiSecret);
        await roomService.createRoom({
          name: roomName,
          metadata: JSON.stringify(roomMetadata),
          emptyTimeout: 600,
          maxParticipants: 2,
        }).catch((err: unknown) => {
          console.warn('[Interview Start] createRoom non-fatal error:', err);
        });

        const at = new AccessToken(rawApiKey, rawApiSecret, {
          identity: `student_${user.id}`,
          name: studentInfo.name,
          metadata: JSON.stringify({ interviewId, role: 'student' }),
          ttl: (durationMinutes + 15) * 60,
        });

        at.addGrant({
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        });

        token = await at.toJwt();
      } catch (tokenErr) {
        console.error('[Interview Start] Token creation error:', tokenErr);
      }
    }

    // Strict credit deduction: If user is not premium, decrement immediately
    let remainingCredits = Math.max(0, 3 - (totalSessions + 1));
    if (!isPremium) {
      const nextCredits = Math.max(0, Math.min(availableCredits - 1, remainingCredits));
      const { data: updatedProfile, error: updateError } = await adminClient
        .from('profiles')
        .update({ interview_credits: nextCredits })
        .eq('id', user.id)
        .select('interview_credits')
        .single();

      if (!updateError && updatedProfile) {
        remainingCredits = updatedProfile.interview_credits;
        await adminClient
          .from('interview_sessions')
          .update({ credit_consumed_at: new Date().toISOString() })
          .eq('id', interviewId);
      }
    }

    return NextResponse.json({
      interviewId,
      roomName,
      token,
      serverUrl: wsUrl,
      remainingCredits,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Interview start failed';
    console.error('[Interview Start] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
