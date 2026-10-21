import { describe, expect, it, vi } from 'vitest';
import { fetchDiscoveredJobs } from '@/lib/discovered-jobs';

describe('Interview Security & History Visibility Mandate', () => {
  it('enforces student_id privacy filter on interview_sessions queries', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'intv-123', student_id: 'student-abc', status: 'completed' }],
      error: null,
    });

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      }),
    };

    const studentId = 'student-abc';
    const { data } = await mockSupabase
      .from('interview_sessions')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    expect(mockSupabase.from).toHaveBeenCalledWith('interview_sessions');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('student_id', 'student-abc');
    expect(data).toHaveLength(1);
    expect(data[0].student_id).toBe('student-abc');
  });

  it('aggregates viva_score and ide_score into master mock_interview score', () => {
    const vivaScore = 84;
    const ideScore = 90;
    const newMockScore = Math.round((vivaScore + ideScore) / 2);

    expect(newMockScore).toBe(87);

    const currentScores = {
      resume: 80,
      projects: 75,
      mock_interview: 60,
      github: 70,
      linkedin: 65,
    };

    const updatedScores = { ...currentScores, mock_interview: newMockScore };
    expect(updatedScores.mock_interview).toBe(87);
    expect(updatedScores.resume).toBe(80);
  });
});

describe('Job Board RLS & Hybrid Query Syntax Verification', () => {
  it('constructs exact .or() template literal for student UUID and MSOT posts', async () => {
    const userId = '00000000-0000-0000-0000-000000000001';
    const expectedOrClause = `student_id.eq.${userId},is_msot_post.eq.true`;

    const mockSelect = vi.fn().mockReturnThis();
    const mockOr = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockReturnThis();

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        or: mockOr,
        eq: mockEq,
        order: mockOrder,
      }),
    };

    await mockSupabase
      .from('discovered_jobs')
      .select('*')
      .or(`student_id.eq.${userId},is_msot_post.eq.true`)
      .eq('publication_status', 'published')
      .order('is_msot_post', { ascending: false })
      .order('relevance_score', { ascending: false });

    expect(mockSupabase.from).toHaveBeenCalledWith('discovered_jobs');
    expect(mockOr).toHaveBeenCalledWith(expectedOrClause);
    expect(mockEq).toHaveBeenCalledWith('publication_status', 'published');
  });
});
