import { redirect } from 'next/navigation';
import { AdminInterviewsWorkspace } from '@/components/admin/AdminInterviewsWorkspace';
import {
  ADMIN_INTERVIEW_COLUMNS,
  collectInterviewStudentIds,
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

  const { data: sessionData, error: sessionsError } = await supabase
    .from('interview_sessions')
    .select(ADMIN_INTERVIEW_COLUMNS)
    .eq('status', 'completed')
    .not('result', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(100);

  if (sessionsError) {
    return { interviews: [], error: 'Completed interview sessions could not be loaded.' };
  }

  const sessionsValue: unknown = sessionData;
  const studentIds = collectInterviewStudentIds(sessionsValue);
  if (studentIds.length === 0) return { interviews: [], error: null };

  const { data: profileData, error: studentsError } = await supabase
    .from('profiles')
    .select('id,display_name,email')
    .in('id', studentIds);

  if (studentsError) {
    return {
      interviews: normalizeFacultyVivas(sessionsValue, []),
      error: 'Candidate identities could not be loaded.',
    };
  }

  const profilesValue: unknown = profileData;
  return { interviews: normalizeFacultyVivas(sessionsValue, profilesValue), error: null };
}

export default async function AdminInterviewsPage() {
  const { interviews, error } = await loadFacultyVivas();
  return <AdminInterviewsWorkspace interviews={interviews} loadError={error} />;
}
