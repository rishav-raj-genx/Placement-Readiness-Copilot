import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { AdminInterviewsWorkspace } from '@/components/admin/AdminInterviewsWorkspace';
import {
  normalizeFacultyVivas,
  type FacultyVivaRecord,
} from '@/lib/admin-interviews';
import { createServerSessionClient } from '@/lib/supabase-session-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface FacultyVivaData {
  interviews: FacultyVivaRecord[];
  error: string | null;
}

function hasAdminRole(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  return profile.role === 'admin';
}

async function loadFacultyVivas(): Promise<FacultyVivaData> {
  const supabase = createServerSessionClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect('/auth?redirectTo=/admin-interviews');

  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();
  const adminProfileValue: unknown = adminProfile;
  if (profileError || !hasAdminRole(adminProfileValue)) redirect('/dashboard');

  try {
    // This completely bypasses RLS. ONLY use in protected admin server routes.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: completedVivas, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (sessionError) {
      console.error('Admin Viva Fetch Error:', sessionError);
      return { interviews: [], error: null };
    }

    const studentIds = Array.from(
      new Set(
        (completedVivas || []).flatMap((item: Record<string, unknown>) => {
          const id = typeof item.student_id === 'string'
            ? item.student_id
            : typeof item.user_id === 'string'
            ? item.user_id
            : null;
          return id ? [id] : [];
        }),
      ),
    );

    let candidateProfiles: unknown[] = [];
    if (studentIds.length > 0) {
      const { data: profilesData } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, email, github_username, role')
        .in('id', studentIds);
      if (profilesData) candidateProfiles = profilesData;
    }

    return {
      interviews: normalizeFacultyVivas(completedVivas, candidateProfiles),
      error: null,
    };
  } catch (err) {
    console.error('Admin Viva Fetch Error:', err);
    return {
      interviews: [],
      error: null,
    };
  }
}

export default async function AdminInterviewsPage() {
  const { interviews, error } = await loadFacultyVivas();
  return <AdminInterviewsWorkspace interviews={interviews} loadError={error} />;
}
