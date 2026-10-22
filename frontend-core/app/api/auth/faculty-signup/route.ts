import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase-service-server';

export const dynamic = 'force-dynamic';

interface FacultySignUpBody {
  fullName?: unknown;
  email?: unknown;
  password?: unknown;
  facultyCode?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BLOCKED_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'protonmail.com',
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const { fullName, email, password, facultyCode } = rawBody as FacultySignUpBody;

    // 1. Strict Payload Validation
    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please enter your full name.' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid institutional email address.' },
        { status: 400 }
      );
    }

    const emailDomain = email.trim().toLowerCase().split('@')[1]?.trim();
    if (
      emailDomain &&
      (BLOCKED_DOMAINS.includes(emailDomain) ||
        BLOCKED_DOMAINS.some((b) => emailDomain.endsWith('.' + b)))
    ) {
      return NextResponse.json(
        {
          error:
            'Please use your official organizational email ID. Normal personal accounts are not permitted for staff.',
        },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if (typeof facultyCode !== 'string' || !facultyCode.trim()) {
      return NextResponse.json(
        { error: 'Faculty Authorization Code is required.' },
        { status: 400 }
      );
    }

    // 2. Server-side Gatekeeping: Verify Faculty Authorization Code against env
    const expectedCode = (
      process.env.ADMIN_INVITE_CODE ||
      process.env.FACULTY_INVITE_CODE ||
      ''
    ).trim();

    if (!expectedCode || facultyCode.trim() !== expectedCode) {
      return NextResponse.json(
        { error: 'Invalid Faculty Authorization Code.' },
        { status: 403 }
      );
    }

    // 3. Supabase Admin Client Initialization
    const supabaseAdmin = createSupabaseServiceClient();

    const normalizedEmail = email.trim().toLowerCase();
    const cleanDisplayName = fullName.trim();

    // 4. Create User Identity via Supabase Admin Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: cleanDisplayName,
        full_name: cleanDisplayName,
        role: 'admin',
      },
    });

    if (authError || !authData.user) {
      const errorMsg = authError?.message || 'Unable to register user identity.';
      const isDuplicate =
        errorMsg.toLowerCase().includes('already registered') ||
        errorMsg.toLowerCase().includes('already exists') ||
        authError?.status === 422;

      return NextResponse.json(
        {
          error: isDuplicate
            ? 'An account with this email address already exists.'
            : errorMsg,
        },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    const userId = authData.user.id;
    const nowIso = new Date().toISOString();

    // 5. Database Insertion: Explicitly Set role = 'admin' in profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: userId,
        email: normalizedEmail,
        display_name: cleanDisplayName,
        role: 'admin',
        onboarding_completed_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.error('Failed to initialize faculty profile in profiles table:', profileError);
      // Clean up orphaned auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => null);
      return NextResponse.json(
        { error: 'Failed to initialize faculty profile. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Faculty account created successfully.',
      userId,
      role: 'admin',
    });
  } catch (error: unknown) {
    console.error('Faculty signup internal error:', error);
    const message = error instanceof Error ? error.message : 'Server error during faculty registration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
