import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { createServerSessionClient } from '@/lib/supabase-session-server';

/**
 * POST /api/livekit/token
 *
 * Generates a short-lived LiveKit room token for the authenticated student.
 * This runs exclusively server-side — LIVEKIT_API_KEY and LIVEKIT_API_SECRET
 * are NEVER sent to the browser.
 *
 * Request body: { roomName: string }
 * Response:     { token: string, livekitUrl: string }
 *
 * Integration note for Rewas:
 *   - The token grants the student access to `roomName`.
 *   - Pass this token to your LiveKit component on the frontend:
 *       <LiveKitRoom token={token} serverUrl={livekitUrl} ... />
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // ── 1. Validate server environment ────────────────────────────────────
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error('[LiveKit Token] Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or NEXT_PUBLIC_LIVEKIT_URL');
      return NextResponse.json(
        { error: 'LiveKit is not configured on this server.' },
        { status: 503 }
      );
    }

    // ── 2. Authenticate the caller via Supabase JWT ────────────────────────
    const supabase = createServerSessionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // ── 3. Validate request body ───────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const { roomName } = body as { roomName?: string };

    if (!roomName || typeof roomName !== 'string' || roomName.trim().length === 0) {
      return NextResponse.json({ error: 'roomName is required' }, { status: 400 });
    }

    // Prevent students from joining other students' rooms.
    // Query interview_sessions to verify exact room ownership and eligible session state.
    const { data: sessionRecord, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, user_id, student_id, status, livekit_room_name')
      .eq('livekit_room_name', roomName.trim())
      .maybeSingle();

    if (sessionError || !sessionRecord) {
      return NextResponse.json(
        { error: 'Interview room not found.' },
        { status: 404 }
      );
    }

    const sessionOwner = sessionRecord.user_id || sessionRecord.student_id;
    if (sessionOwner !== user.id) {
      return NextResponse.json(
        { error: 'You may only join your own interview room.' },
        { status: 403 }
      );
    }

    const eligibleStatuses = ['created', 'active', 'in_progress'];
    if (!eligibleStatuses.includes(sessionRecord.status)) {
      return NextResponse.json(
        { error: `Interview session is no longer active (current status: ${sessionRecord.status}).` },
        { status: 409 }
      );
    }

    // ── 4. Generate the LiveKit access token ───────────────────────────────
    const token = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.email ?? user.id,
      // Match the platform's 30-minute interview maximum.
      ttl: 60 * 30,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,      // Student can send audio
      canSubscribe: true,    // Student can hear the AI agent
      canPublishData: true,  // For sending transcript data over data channel
    });

    const tokenValue = await token.toJwt();

    return NextResponse.json({ token: tokenValue, livekitUrl });
  } catch (err) {
    console.error('[LiveKit Token] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
