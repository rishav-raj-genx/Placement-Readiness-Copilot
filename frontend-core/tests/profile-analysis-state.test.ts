import { describe, expect, it } from 'vitest';
import { normalizeProfileReviewRecord } from '@/lib/profile-adapters';

describe('profile analysis state', () => {
  it('preserves a failed state and explicit error', () => {
    expect(normalizeProfileReviewRecord({ student_id: 'user-1', status: 'failed', result: null, error_message: 'Service timed out', updated_at: '2026-10-19T00:00:00Z' })).toEqual({ studentId: 'user-1', status: 'failed', result: null, errorMessage: 'Service timed out', updatedAt: '2026-10-19T00:00:00Z' });
  });
});
