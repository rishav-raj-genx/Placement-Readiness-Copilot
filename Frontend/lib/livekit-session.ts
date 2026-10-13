import type {
  LiveKitSessionRequest,
  LiveKitSessionResponse,
} from '@/types';
import { supabase } from '@/lib/supabase-client';

export async function createInterviewSession(
  requestBody: LiveKitSessionRequest
): Promise<LiveKitSessionResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be signed in to start a LiveKit interview.');
  }

  const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/interview-session`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `Session creation failed (${response.status})`);
  }

  const data: LiveKitSessionResponse = await response.json();

  if (!data.serverUrl || !data.roomName || !data.token || !data.interviewId) {
    throw new Error('Invalid session response from server.');
  }

  return data;
}
