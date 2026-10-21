import { NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { createAdminClient } from '@/lib/supabase-server';
import { normalizeUserProfile, PROFILE_SELECT_COLUMNS } from '@/lib/profile-adapters';

export const runtime = 'nodejs';

/**
 * Strips unrecognized, undefined, and non-whitelisted fields before passing to Supabase
 * to prevent schema rejection errors.
 */
function sanitizeProfilePayload(body: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.displayName === 'string' && body.displayName.trim()) {
    payload.display_name = body.displayName.trim();
  } else if (typeof body.display_name === 'string' && body.display_name.trim()) {
    payload.display_name = body.display_name.trim();
  }

  if (typeof body.targetRole === 'string' && body.targetRole.trim()) {
    payload.target_role = body.targetRole.trim();
  } else if (typeof body.target_role === 'string' && body.target_role.trim()) {
    payload.target_role = body.target_role.trim();
  }

  if (typeof body.githubUsername === 'string') {
    payload.github_username = body.githubUsername.trim() || null;
  } else if (typeof body.github_username === 'string') {
    payload.github_username = body.github_username.trim() || null;
  }

  if (typeof body.leetcodeUrl === 'string') {
    payload.leetcode_url = body.leetcodeUrl.trim() || null;
  } else if (typeof body.leetcode_url === 'string') {
    payload.leetcode_url = body.leetcode_url.trim() || null;
  }

  if (typeof body.codingProfileUrl === 'string') {
    payload.coding_profile_url = body.codingProfileUrl.trim() || null;
  } else if (typeof body.coding_profile_url === 'string') {
    payload.coding_profile_url = body.coding_profile_url.trim() || null;
  }

  if (typeof body.linkedinText === 'string') {
    payload.linkedin_text = body.linkedinText.trim() || null;
  } else if (typeof body.linkedin_text === 'string') {
    payload.linkedin_text = body.linkedin_text.trim() || null;
  }

  if (typeof body.linkedinUrl === 'string') {
    payload.linkedin_url = body.linkedinUrl.trim() || null;
  } else if (typeof body.linkedin_url === 'string') {
    payload.linkedin_url = body.linkedin_url.trim() || null;
  }

  if (typeof body.resumePath === 'string') {
    payload.resume_pdf_path = body.resumePath.trim() || null;
  } else if (typeof body.resumePdfPath === 'string') {
    payload.resume_pdf_path = body.resumePdfPath.trim() || null;
  } else if (typeof body.resume_pdf_path === 'string') {
    payload.resume_pdf_path = body.resume_pdf_path.trim() || null;
  }

  if (typeof body.linkedinPath === 'string') {
    payload.linkedin_pdf_path = body.linkedinPath.trim() || null;
  } else if (typeof body.linkedinPdfPath === 'string') {
    payload.linkedin_pdf_path = body.linkedinPdfPath.trim() || null;
  } else if (typeof body.linkedin_pdf_path === 'string') {
    payload.linkedin_pdf_path = body.linkedin_pdf_path.trim() || null;
  }

  if (Array.isArray(body.projects)) {
    payload.projects = body.projects;
  }

  if (Array.isArray(body.skills)) {
    payload.skills = body.skills;
  }

  if (Array.isArray(body.targetLocations)) {
    payload.target_locations = body.targetLocations;
  } else if (Array.isArray(body.target_locations)) {
    payload.target_locations = body.target_locations;
  }

  return payload;
}

export async function GET(): Promise<NextResponse> {
  try {
    const sessionClient = createServerSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select(PROFILE_SELECT_COLUMNS)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: normalizeUserProfile(data) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleProfileUpdate(request: Request): Promise<NextResponse> {
  try {
    const sessionClient = createServerSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    let studentId = user?.id ?? null;

    // Service key authorization fallback
    if (!studentId) {
      const authHeader = request.headers.get('authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const internalKey = process.env.INTERNAL_SERVICE_KEY?.trim();
      if (internalKey && token && token === internalKey) {
        // Will be extracted from body
      } else {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
      }
    }

    const rawBody: unknown = await request.json().catch(() => ({}));
    if (typeof rawBody !== 'object' || rawBody === null) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const body = rawBody as Record<string, unknown>;

    if (!studentId && typeof body.userId === 'string') {
      studentId = body.userId.trim();
    }

    if (!studentId) {
      return NextResponse.json({ error: 'Missing candidate identifier' }, { status: 400 });
    }

    const admin = createAdminClient();
    const sanitizedPayload = sanitizeProfilePayload(body);

    // Attempt update with full sanitized payload
    let updateError: { message?: string; code?: string } | null = null;
    const { error: initialError } = await admin
      .from('profiles')
      .update(sanitizedPayload)
      .eq('id', studentId);

    if (initialError) {
      updateError = initialError;
      // If error is caused by missing leetcode_url / coding_profile_url / linkedin_text in unmigrated databases,
      // strip them and retry core fields so the profile save succeeds seamlessly
      const errStr = (initialError.message || '').toLowerCase();
      if (
        initialError.code === 'PGRST204' ||
        errStr.includes('leetcode_url') ||
        errStr.includes('coding_profile_url') ||
        errStr.includes('linkedin_text') ||
        errStr.includes('column')
      ) {
        const corePayload = { ...sanitizedPayload };
        delete corePayload.leetcode_url;
        delete corePayload.coding_profile_url;
        delete corePayload.linkedin_text;

        const { error: retryError } = await admin
          .from('profiles')
          .update(corePayload)
          .eq('id', studentId);

        if (!retryError) {
          updateError = null;
        } else {
          updateError = retryError;
        }
      }
    }

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update profile record in database.' },
        { status: 500 }
      );
    }

    const { data: updatedProfile } = await admin
      .from('profiles')
      .select(PROFILE_SELECT_COLUMNS)
      .eq('id', studentId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully.',
      profile: normalizeUserProfile(updatedProfile),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error while saving profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleProfileUpdate(request);
}

export async function PATCH(request: Request): Promise<NextResponse> {
  return handleProfileUpdate(request);
}

export async function PUT(request: Request): Promise<NextResponse> {
  return handleProfileUpdate(request);
}
