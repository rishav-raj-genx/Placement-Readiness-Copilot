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

  it('collects unique candidate IDs and rejects unsafe audio URLs', () => {
    expect(collectInterviewStudentIds([completedSession, completedSession])).toEqual(['student-1']);
    const [review] = normalizeFacultyVivas([{ ...completedSession, audio_url: 'javascript:alert(1)' }], []);
    expect(review.audioUrl).toBeNull();
  });
});
