export const INTERVIEW_RECORDING_BUCKET = 'interview_recordings';

export const INTERVIEW_RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
] as const;

export function selectInterviewRecordingMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string | null {
  for (const mimeType of INTERVIEW_RECORDING_MIME_TYPES) {
    if (isTypeSupported(mimeType)) return mimeType;
  }
  return null;
}

function sanitizePathSegment(value: string, label: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!sanitized) {
    throw new Error(`${label} is required to store the interview recording.`);
  }
  return sanitized;
}

export function createInterviewRecordingPath(
  userId: string,
  interviewId: string,
  recordingId: string,
): string {
  const owner = sanitizePathSegment(userId, 'User ID');
  const interview = sanitizePathSegment(interviewId, 'Interview ID');
  const recording = sanitizePathSegment(recordingId, 'Recording ID');
  return `${owner}/${interview}-${recording}.webm`;
}
