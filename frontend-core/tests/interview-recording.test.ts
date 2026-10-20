import { describe, expect, it, vi } from 'vitest';

import {
  createInterviewRecordingPath,
  selectInterviewRecordingMimeType,
} from '@/lib/interview-recording';

describe('interview recording helpers', () => {
  it('prefers Opus WebM when the browser supports it', () => {
    const isSupported = vi.fn((mimeType: string) => mimeType === 'audio/webm;codecs=opus');

    expect(selectInterviewRecordingMimeType(isSupported)).toBe('audio/webm;codecs=opus');
    expect(isSupported).toHaveBeenCalledWith('audio/webm;codecs=opus');
  });

  it('returns null when WebM recording is unavailable', () => {
    expect(selectInterviewRecordingMimeType(() => false)).toBeNull();
  });

  it('creates an owner-scoped unique WebM object path', () => {
    expect(createInterviewRecordingPath('user-1', 'intv_42', 'recording-7')).toBe(
      'user-1/intv_42-recording-7.webm',
    );
  });

  it('sanitizes unsafe storage path characters', () => {
    expect(createInterviewRecordingPath('user/1', 'intv 42', 'recording.7')).toBe(
      'user_1/intv_42-recording_7.webm',
    );
  });
});
