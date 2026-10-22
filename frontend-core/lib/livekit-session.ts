import type { LiveKitSessionRequest, LiveKitSessionResponse } from '@/types';
import { supabase } from '@/lib/supabase-client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface LiveKitClientConfiguration {
  url: string | null;
  status: 'ready' | 'missing' | 'invalid';
}

function normalizeLiveKitUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  try {
    const protocol = new URL(normalized).protocol;
    if (protocol !== 'wss:' && protocol !== 'ws:') throw new Error();
  } catch {
    throw new Error('NEXT_PUBLIC_LIVEKIT_URL must be a valid ws:// or wss:// URL.');
  }
  return normalized;
}

function tryNormalizeLiveKitUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return normalizeLiveKitUrl(value);
  } catch {
    return null;
  }
}

export function getLiveKitClientConfiguration(): LiveKitClientConfiguration {
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;
  if (!livekitUrl?.trim()) return { url: null, status: 'missing' };
  const normalizedUrl = tryNormalizeLiveKitUrl(livekitUrl);
  return normalizedUrl
    ? { url: normalizedUrl, status: 'ready' }
    : { url: null, status: 'invalid' };
}

export function resolveLiveKitConnectionUrl(
  fallbackServerUrl?: string,
  configuredServerUrl?: string,
): string {
  const livekitUrl = configuredServerUrl
    ?? process.env.NEXT_PUBLIC_LIVEKIT_URL
    ?? process.env.LIVEKIT_URL;
  const configuredUrl = tryNormalizeLiveKitUrl(livekitUrl);
  const fallbackUrl = tryNormalizeLiveKitUrl(fallbackServerUrl);

  if (configuredUrl && fallbackUrl && configuredUrl !== fallbackUrl) {
    throw new Error(
      'LiveKit server configuration mismatch: the session token and browser URL target different servers.',
    );
  }
  if (configuredUrl) return configuredUrl;
  if (fallbackUrl) return fallbackUrl;
  throw new Error('The LiveKit server stream is initializing. Please try again shortly.');
}

export class LiveKitApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, code?: string, status: number = 500) {
    super(message);
    this.name = 'LiveKitApiError';
    this.code = code;
    this.status = status;
  }
}

export function readLiveKitApiError(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }
  return `Interview session creation failed (${status}).`;
}

export function parseLiveKitSessionResponse(
  payload: unknown,
  configuredServerUrl?: string,
): LiveKitSessionResponse {
  if (!isRecord(payload)) {
    throw new Error('The interview service returned an invalid response.');
  }

  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  const roomName = typeof payload.roomName === 'string' ? payload.roomName.trim() : '';
  const interviewId = typeof payload.interviewId === 'string' ? payload.interviewId.trim() : '';
  const responseServerUrl = typeof payload.serverUrl === 'string' ? payload.serverUrl.trim() : '';

  if (!token) throw new Error('The interview service returned an empty LiveKit token.');
  if (token.split('.').length !== 3) {
    throw new Error('The interview service returned a malformed LiveKit token.');
  }
  if (!roomName || !interviewId) {
    throw new Error('The interview service response is missing the room or interview ID.');
  }

  const publicServerUrl = resolveLiveKitConnectionUrl(responseServerUrl, configuredServerUrl);

  return {
    token,
    roomName,
    interviewId,
    serverUrl: publicServerUrl,
  };
}

export async function createInterviewSession(
  requestBody: LiveKitSessionRequest,
): Promise<LiveKitSessionResponse> {
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw new Error(`Unable to verify your session: ${sessionError.message}`);
  if (!session?.access_token) {
    throw new Error('You must be signed in to start a LiveKit interview.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public configuration is missing.');
  }

  const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/interview-session`;

  let response: Response | null = null;
  try {
    response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    // If Edge function network call fails, try the internal Next.js /api/interview/start route
    try {
      response = await fetch('/api/interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (innerError) {
      const message = innerError instanceof Error ? innerError.message : 'Network request failed';
      throw new Error(`Could not reach the interview service: ${message}`);
    }
  }

  if (!response) {
    throw new Error('Could not reach the interview service: No response received.');
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = readLiveKitApiError(payload, response.status);
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined;
    throw new LiveKitApiError(message, code, response.status);
  }

  return parseLiveKitSessionResponse(payload, livekitUrl);
}
