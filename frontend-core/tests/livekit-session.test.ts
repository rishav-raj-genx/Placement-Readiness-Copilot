import { describe, expect, it } from 'vitest';

import {
  parseLiveKitSessionResponse,
  readLiveKitApiError,
} from '@/lib/livekit-session';

const configuredUrl = 'wss://hireable.livekit.cloud';

describe('LiveKit session response validation', () => {
  it('returns a validated token with the configured public server URL', () => {
    expect(parseLiveKitSessionResponse({
      token: 'header.payload.signature',
      roomName: 'interview_student_1',
      interviewId: 'intv_1',
      serverUrl: `${configuredUrl}/`,
    }, configuredUrl)).toEqual({
      token: 'header.payload.signature',
      roomName: 'interview_student_1',
      interviewId: 'intv_1',
      serverUrl: configuredUrl,
    });
  });

  it('rejects an empty or malformed participant token', () => {
    const response = {
      roomName: 'interview_student_1',
      interviewId: 'intv_1',
      serverUrl: configuredUrl,
    };

    expect(() => parseLiveKitSessionResponse({ ...response, token: '' }, configuredUrl))
      .toThrow('empty LiveKit token');
    expect(() => parseLiveKitSessionResponse({ ...response, token: 'not-a-jwt' }, configuredUrl))
      .toThrow('malformed LiveKit token');
  });

  it('rejects tokens issued for a different LiveKit server', () => {
    expect(() => parseLiveKitSessionResponse({
      token: 'header.payload.signature',
      roomName: 'interview_student_1',
      interviewId: 'intv_1',
      serverUrl: 'wss://different.livekit.cloud',
    }, configuredUrl)).toThrow('different servers');
  });

  it('preserves a specific backend error message', () => {
    expect(readLiveKitApiError({ error: 'LiveKit room creation failed: invalid API key' }, 502))
      .toBe('LiveKit room creation failed: invalid API key');
    expect(readLiveKitApiError(null, 502)).toBe('Interview session creation failed (502).');
  });
});
