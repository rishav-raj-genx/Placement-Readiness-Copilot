import { describe, expect, it } from 'vitest';
import {
  isInterviewSessionCompleted,
  normalizeInterviewTranscript,
  parseInterviewRecord,
} from '@/lib/interview-history';

describe('interview history normalization', () => {
  it('recognizes persisted results even when a legacy status was not updated', () => {
    expect(isInterviewSessionCompleted({
      status: 'active',
      result: JSON.stringify({ interview_score: 82, summary: 'Strong fundamentals.' }),
    })).toBe(true);
  });

  it('never promotes an abandoned result to completed', () => {
    expect(isInterviewSessionCompleted({
      status: 'completed',
      completed_at: '2026-10-22T12:00:00.000Z',
      result: { interview_score: 48, is_abandoned: true, session_status: 'abandoned' },
    })).toBe(false);
  });

  it('parses stringified STT transcript arrays and normalizes speaker aliases', () => {
    const transcript = normalizeInterviewTranscript(JSON.stringify([
      { turn_id: 'q1', speaker: 'ai', text: 'Explain event loops.', timestamp_sec: 1_000 },
      { turn_id: 'a1', role: 'candidate', content: 'They schedule asynchronous work.', timestamp_sec: 1_018 },
    ]));

    expect(transcript).toEqual([
      { id: 'q1', speaker: 'interviewer', text: 'Explain event loops.', timestampSeconds: 1_000 },
      { id: 'a1', speaker: 'student', text: 'They schedule asynchronous work.', timestampSeconds: 1_018 },
    ]);
  });

  it('parses stringified interview result records', () => {
    expect(parseInterviewRecord('{"summary":"Clear explanation","finalScore":88}')).toEqual({
      summary: 'Clear explanation',
      finalScore: 88,
    });
  });
});
