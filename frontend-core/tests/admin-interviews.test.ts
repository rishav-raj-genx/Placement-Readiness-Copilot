import { describe, expect, it } from 'vitest';
import {
  collectInterviewStudentIds,
  normalizeFacultyVivas,
} from '@/lib/admin-interviews';

const completedSession = {
  id: 'intv-1',
  student_id: 'student-1',
  user_id: 'student-1',
  target_role: 'Frontend Engineer',
  status: 'completed',
  interview_score: 76,
  original_ai_score: null,
  audio_url: 'https://media.example/interviews/intv-1.mp3',
  completed_at: '2026-10-20T10:00:00.000Z',
  created_at: '2026-10-20T09:30:00.000Z',
  score_override_reason: null,
  score_overridden_by_name: null,
  score_overridden_at: null,
  result: {
    interview_score: 76,
    ai_confidence: 0.58,
    summary: 'A structured interview with several incomplete technical answers.',
    transcript: [
      { speaker: 'ai', timestamp_sec: 0, text: 'Tell me about your recent project.' },
      { speaker: 'student', timestamp_sec: 12, text: 'I built a placement platform.' },
    ],
    dimensions: {
      technical_depth: {
        score: 72,
        feedback: 'Good fundamentals.',
        strengths: ['Clear terminology'],
        improvement_areas: ['Add implementation details'],
      },
    },
  },
};

describe('faculty viva normalization', () => {
  it('builds the audit record and flags low-confidence AI results', () => {
    const profiles = [{ id: 'student-1', display_name: 'Asha Rao', email: 'asha@example.com' }];
    const [review] = normalizeFacultyVivas([completedSession], profiles);

    expect(review.studentName).toBe('Asha Rao');
    expect(review.aiScore).toBe(76);
    expect(review.effectiveScore).toBe(76);
    expect(review.aiConfidence).toBe(0.58);
    expect(review.needsReview).toBe(true);
    expect(review.transcript).toHaveLength(2);
    expect(review.rubric[0].label).toBe('Technical Depth');
    expect(review.profileHref).toBe('/admin-students/student-1');
    expect(review.hasAiScore).toBe(true);
    expect(review.adminScore).toBeNull();
  });

  it('preserves the original AI score after a faculty override', () => {
    const [review] = normalizeFacultyVivas([{
      ...completedSession,
      interview_score: 84,
      original_ai_score: 76,
      score_override_reason: 'Transcript evidence supports a higher score.',
      score_overridden_by_name: 'Dr Mehta',
      score_overridden_at: '2026-10-20T11:00:00.000Z',
      result: { ...completedSession.result, interview_score: 84 },
    }], []);

    expect(review.aiScore).toBe(76);
    expect(review.effectiveScore).toBe(84);
    expect(review.override?.facultyName).toBe('Dr Mehta');
  });

  it('normalizes a stringified transcript for faculty review', () => {
    const [review] = normalizeFacultyVivas([{
      ...completedSession,
      transcript: JSON.stringify([
        { turn_id: 1, role: 'interviewer', content: 'Describe your architecture.', timestamp_sec: 0 },
        { turn_id: 2, role: 'student', content: 'I used an event-driven design.', timestamp_sec: 14 },
      ]),
    }], []);

    expect(review.transcript).toHaveLength(2);
    expect(review.transcript[0]).toMatchObject({ speaker: 'ai', text: 'Describe your architecture.' });
    expect(review.transcript[1]).toMatchObject({ speaker: 'student', timestampSeconds: 14 });
  });

  it('prefers authoritative evidence and explicit faculty override fields', () => {
    const [review] = normalizeFacultyVivas([{
      ...completedSession,
      transcript: [
        { speaker: 'interviewer', timestamp: 1_800_000_000_000, text: 'Explain the trade-off.' },
        { speaker: 'student', timestamp: 1_800_000_012_000, text: 'I would partition by tenant.' },
      ],
      code_history: 'function partitionByTenant() {\n  return true;\n}',
      viva_scores: {
        interview_score: 76,
        summary: 'Evidence-backed evaluation.',
        dimensions: {
          system_design: {
            score: 81,
            feedback: 'Strong partitioning discussion.',
            strengths: ['Explained isolation'],
            improvement_areas: ['Quantify capacity'],
          },
        },
      },
      admin_score: 82,
      admin_feedback: 'Transcript evidence supports a higher score.',
      admin_scored_by_name: 'Dr Mehta',
      admin_scored_at: '2026-10-20T11:00:00.000Z',
    }], []);

    expect(review.aiScore).toBe(76);
    expect(review.effectiveScore).toBe(82);
    expect(review.adminScore).toBe(82);
    expect(review.adminFeedback).toBe('Transcript evidence supports a higher score.');
    expect(review.summary).toBe('Evidence-backed evaluation.');
    expect(review.rubric[0].label).toBe('System Design');
    expect(review.codeHistory).toContain('partitionByTenant');
    expect(review.transcript[1].timestampSeconds).toBe(12);
    expect(review.override?.facultyName).toBe('Dr Mehta');
  });

  it('keeps completed sessions whose AI scoring payload is incomplete', () => {
    const [review] = normalizeFacultyVivas([{
      ...completedSession,
      target_role: '',
      interview_score: null,
      result: null,
      transcript: [{ speaker: 'student', timestamp_sec: 0, text: 'Raw evidence survived.' }],
    }], []);

    expect(review.id).toBe('intv-1');
    expect(review.targetRole).toBe('Target role unavailable');
    expect(review.hasAiScore).toBe(false);
    expect(review.aiScore).toBe(0);
    expect(review.transcript[0].text).toBe('Raw evidence survived.');
  });

  it('collects unique candidate IDs and rejects unsafe audio URLs', () => {
    expect(collectInterviewStudentIds([completedSession, completedSession])).toEqual(['student-1']);
    const [review] = normalizeFacultyVivas([{ ...completedSession, audio_url: 'javascript:alert(1)' }], []);
    expect(review.audioUrl).toBeNull();
  });

  it('correctly extracts candidate identity from joined profiles object', () => {
    const joinedSession = {
      ...completedSession,
      profiles: {
        name: 'Rohan Sharma',
        email: 'rohan@example.com',
        github_handle: 'rohansharma',
      },
    };
    const [review] = normalizeFacultyVivas([joinedSession], []);
    expect(review.studentName).toBe('Rohan Sharma');
    expect(review.studentEmail).toBe('rohan@example.com');
  });

  it('returns empty array when no completed interviews exist or error occurs', () => {
    expect(normalizeFacultyVivas([], [])).toEqual([]);
    expect(normalizeFacultyVivas(null, [])).toEqual([]);
  });
});
