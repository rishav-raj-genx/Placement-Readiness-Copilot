export type InterviewTranscriptSpeaker = 'interviewer' | 'student';

export interface InterviewTranscriptTurn {
  id: string;
  speaker: InterviewTranscriptSpeaker;
  text: string;
  timestampSeconds: number | null;
}

type UnknownRecord = Record<string, unknown>;

export function isInterviewRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseInterviewRecord(value: unknown): UnknownRecord {
  if (isInterviewRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isInterviewRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isInterviewSessionCompleted(session: {
  status?: unknown;
  completed_at?: unknown;
  result?: unknown;
}): boolean {
  const status = typeof session.status === 'string' ? session.status.trim().toLowerCase() : '';
  if (['abandoned', 'cancelled', 'canceled', 'failed'].includes(status)) return false;

  const result = parseInterviewRecord(session.result);
  const resultStatus = typeof result.session_status === 'string'
    ? result.session_status.trim().toLowerCase()
    : '';
  if (
    ['abandoned', 'cancelled', 'canceled', 'failed'].includes(resultStatus)
    || result.is_abandoned === true
  ) {
    return false;
  }
  if (['completed', 'complete', 'finished'].includes(status)) return true;
  if (typeof session.completed_at === 'string' && session.completed_at.trim()) return true;
  return ['completed', 'complete', 'finished'].includes(resultStatus)
    || typeof result.interview_score === 'number'
    || typeof result.finalScore === 'number';
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readTimestampSeconds(value: UnknownRecord): number | null {
  const raw = value.timestamp_sec ?? value.timestampSeconds ?? value.timestamp ?? value.time;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw > 100_000_000_000 ? raw / 1000 : raw;
}

export function normalizeInterviewTranscript(value: unknown): InterviewTranscriptTurn[] {
  const parsed = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return [];
        }
      })()
    : value;
  if (!Array.isArray(parsed)) return [];

  const turns = parsed.flatMap((item, index): InterviewTranscriptTurn[] => {
    if (!isInterviewRecord(item)) return [];
    const text = readText(item.text ?? item.message ?? item.content);
    if (!text) return [];
    const speakerValue = readText(item.speaker ?? item.role).toLowerCase();
    const speaker: InterviewTranscriptSpeaker = ['student', 'candidate', 'user'].includes(speakerValue)
      ? 'student'
      : 'interviewer';
    return [{
      id: readText(item.id) || readText(item.turn_id) || `turn-${index + 1}`,
      speaker,
      text,
      timestampSeconds: readTimestampSeconds(item),
    }];
  });

  const firstEpoch = turns.find((turn) => turn.timestampSeconds !== null && turn.timestampSeconds > 100_000_000)?.timestampSeconds;
  if (firstEpoch === undefined || firstEpoch === null) return turns;
  return turns.map((turn) => ({
    ...turn,
    timestampSeconds: turn.timestampSeconds === null ? null : Math.max(0, turn.timestampSeconds - firstEpoch),
  }));
}

export function readInterviewStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}
