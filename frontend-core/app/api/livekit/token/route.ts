import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

import { createServerSessionClient } from '@/lib/supabase-session-server';

export const runtime = 'nodejs';

interface LiveKitTokenRequest {
  roomName?: unknown;
}

function hasWrappingQuotes(value: string): boolean {
  return (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  );
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
  const rawApiKey = process.env.LIVEKIT_API_KEY;
  const rawApiSecret = process.env.LIVEKIT_API_SECRET;
  const rawWsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  if (!rawApiKey?.trim() || !rawApiSecret?.trim() || !rawWsUrl?.trim()) {
    return NextResponse.json(
      { error: 'Server misconfiguration: LiveKit environment variables are missing.' },
      { status: 500 },
    );
  }

  const apiKey = rawApiKey.trim();
  const apiSecret = rawApiSecret.trim();
  const wsUrl = rawWsUrl.trim();

  console.log(`DEBUG: LIVEKIT_API_KEY loaded, length: ${apiKey.length}`);
  console.log(`DEBUG: LIVEKIT_API_SECRET loaded, length: ${apiSecret.length}`);

  if (rawApiKey !== apiKey || rawApiSecret !== apiSecret || rawWsUrl !== wsUrl) {
    console.warn('[LiveKit Token] Surrounding whitespace was removed from LiveKit configuration.');
  }

  if (hasWrappingQuotes(apiKey) || hasWrappingQuotes(apiSecret)) {
    return NextResponse.json(
      { error: 'Server misconfiguration: LiveKit credentials must not include wrapping quotes.' },
      { status: 500 },
    );
  }

  if (!isValidLiveKitUrl(wsUrl)) {
    return NextResponse.json(
      { error: 'Server misconfiguration: LiveKit URL must use ws:// or wss://.' },
      { status: 500 },
    );
  }

  try {
    const supabase = createServerSessionClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Your session is invalid or expired.' }, { status: 401 });
    }

    // ── Freemium Gatekeeper & Credits Check ──────────────────────────────
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const isPremium = userProfile?.is_premium === true;
    let interviewCredits = typeof userProfile?.interview_credits === 'number'
      ? userProfile.interview_credits
      : null;

    if (interviewCredits === null) {
      const { count } = await supabase
        .from('interview_sessions')
        .select('id', { count: 'exact', head: true })
        .or(`student_id.eq.${user.id},user_id.eq.${user.id}`)
        .in('status', ['completed', 'active', 'in_progress']);

      interviewCredits = Math.max(0, 3 - (count || 0));
    }

    if (!isPremium && interviewCredits <= 0) {
      return NextResponse.json(
        { error: 'Premium required. Out of credits.' },
        { status: 403 }
      );
    }

    const payload: unknown = await request.json().catch(() => null);
    const body: LiveKitTokenRequest =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? payload as LiveKitTokenRequest
        : {};
    const roomName = typeof body.roomName === 'string' ? body.roomName.trim() : '';

    if (!roomName) {
      return NextResponse.json({ error: 'roomName is required.' }, { status: 400 });
    }

    // Prevent students from joining other students' rooms.
    // Query interview_sessions to verify exact room ownership and eligible session state.
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, user_id, student_id, status, livekit_room_name')
      .eq('livekit_room_name', roomName.trim())
      .maybeSingle();

    if (sessionError || !sessionRecord) {
      if (!roomName.includes(user.id) && !roomName.includes(user.id.slice(0, 8))) {
        return NextResponse.json(
          { error: 'Interview room not found.' },
          { status: 404 }
        );
      }
    } else {
      const sessionOwner = sessionRecord.user_id || sessionRecord.student_id;
      if (sessionOwner !== user.id) {
        return NextResponse.json(
          { error: 'You may only join your own interview room.' },
          { status: 403 },
        );
      }

      const eligibleStatuses = ['created', 'active', 'in_progress'];
      if (!eligibleStatuses.includes(sessionRecord.status)) {
        return NextResponse.json(
          { error: `Interview session is no longer active (current status: ${sessionRecord.status}).` },
          { status: 409 }
        );
      }
    }

    // ── 4. Generate the LiveKit access token ───────────────────────────────
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.email ?? user.id,
      // Match the platform's 30-minute interview maximum.
      ttl: 60 * 30,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    if (!token) {
      return NextResponse.json(
        { error: 'LiveKit token generation returned an empty token.' },
        { status: 500 },
      );
    }

    // Decrement credits for non-premium user
    if (!isPremium) {
      try {
        await supabase
          .from('profiles')
          .update({ interview_credits: Math.max(0, interviewCredits - 1) })
          .eq('id', user.id);
      } catch (err) {
        console.warn('[LiveKit Token] Failed to update interview_credits on profiles:', err);
      }
    }

    return NextResponse.json({ token, livekitUrl: wsUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown token generation error';
    console.error(`[LiveKit Token] Token generation failed: ${message}`);
    return NextResponse.json(
      { error: `LiveKit token generation failed: ${message}` },
      { status: 500 },
    );
  }
}
