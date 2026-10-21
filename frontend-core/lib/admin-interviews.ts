type UnknownRecord = Record<string, unknown>;

export const LOW_CONFIDENCE_THRESHOLD = 0.65;

export const ADMIN_INTERVIEW_COLUMNS = [
  'id',
  'student_id',
  'user_id',
  'target_role',
  'status',
  'result',
  'transcript',
  'interview_score',
  'audio_url',
  'completed_at',
  'created_at',
  'original_ai_score',
  'score_override_reason',
  'score_overridden_by_name',
  'score_overridden_at',
].join(',');

export interface VivaTranscriptTurn {
  id: string;
  speaker: 'ai' | 'student';
  text: string;
  timestampSeconds: number;
}

export interface VivaRubricScore {
  key: string;
  label: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvementAreas: string[];
}

export interface VivaScoreOverride {
  reason: string;
  facultyName: string;
  overriddenAt: string;
}

export interface FacultyVivaRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  targetRole: string;
  aiScore: number;
  effectiveScore: number;
  aiConfidence: number | null;
  needsReview: boolean;
  completedAt: string;
  summary: string;
  transcript: VivaTranscriptTurn[];
  audioUrl: string | null;
  rubric: VivaRubricScore[];
  override: VivaScoreOverride | null;
}

interface CandidateIdentity {
  id: string;
  displayName: string;
  email: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readHttpUrl(value: unknown): string | null {
  const candidate = readString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeConfidence(value: unknown): number | null {
  const confidence = readNumber(value);
  if (confidence === null) return null;
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return Math.min(1, Math.max(0, normalized));
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeTranscript(value: unknown): VivaTranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): VivaTranscriptTurn[] => {
    if (!isRecord(item)) return [];
    const speakerValue = readString(item.speaker);
    const speaker = speakerValue === 'student' ? 'student' : speakerValue === 'ai' || speakerValue === 'interviewer' ? 'ai' : null;
    const text = readString(item.text);
    const timestampSeconds = readNumber(item.timestamp_sec ?? item.timestamp);
    if (!speaker || !text) return [];
    return [{
      id: readString(item.id) || `turn-${index}`,
      speaker,
      text,
      timestampSeconds: Math.max(0, timestampSeconds ?? 0),
    }];
  });
}

function normalizeRubric(result: UnknownRecord): VivaRubricScore[] {
  const dimensions = result.dimensions;
  if (isRecord(dimensions)) {
    return Object.entries(dimensions).flatMap(([key, value]): VivaRubricScore[] => {
      if (!isRecord(value)) return [];
      const score = readNumber(value.score);
      if (score === null) return [];
      return [{
        key,
        label: titleCase(key),
        score: Math.min(100, Math.max(0, score)),
        feedback: readString(value.feedback),
        strengths: readStringArray(value.strengths),
        improvementAreas: readStringArray(value.improvement_areas ?? value.critiques),
      }];
    });
  }

  if (!Array.isArray(result.categoryScores)) return [];
  return result.categoryScores.flatMap((value, index): VivaRubricScore[] => {
    if (!isRecord(value)) return [];
    const score = readNumber(value.score);
    if (score === null) return [];
    const category = readString(value.category) || `Category ${index + 1}`;
    return [{
      key: category.toLowerCase().replace(/\s+/g, '_'),
      label: category,
      score: Math.min(100, Math.max(0, score)),
      feedback: readString(value.feedback),
      strengths: readStringArray(value.strengths),
      improvementAreas: readStringArray(value.critiques),
    }];
  });
}

function normalizeCandidates(value: unknown): Map<string, CandidateIdentity> {
  if (!Array.isArray(value)) return new Map();
  const candidates = value.flatMap((item): CandidateIdentity[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    if (!id) return [];
    return [{ id, displayName: readString(item.display_name), email: readString(item.email) }];
  });
  return new Map(candidates.map((candidate) => [candidate.id, candidate]));
}

export function collectInterviewStudentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.flatMap((item): string[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.student_id) || readString(item.user_id);
    return id ? [id] : [];
  });
  return Array.from(new Set(ids));
}

export function normalizeFacultyVivas(
  sessionsValue: unknown,
  profilesValue: unknown,
): FacultyVivaRecord[] {
  if (!Array.isArray(sessionsValue)) return [];
  const candidates = normalizeCandidates(profilesValue);

  return sessionsValue.flatMap((item): FacultyVivaRecord[] => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const studentId = readString(item.student_id) || readString(item.user_id);
    const targetRole = readString(item.target_role);
    const rawResult = item.result;
    const result = isRecord(rawResult)
      ? rawResult
      : typeof rawResult === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(rawResult);
              return isRecord(parsed) ? parsed : null;
            } catch {
              return null;
            }
          })()
        : null;
    const resultRecord = result ?? {};
    const effectiveScore = readNumber(item.interview_score) ?? readNumber(resultRecord.interview_score ?? resultRecord.finalScore);
    if (!id || !studentId || !targetRole || effectiveScore === null) return [];

    const joinedProfile = isRecord(item.profiles)
      ? item.profiles
      : Array.isArray(item.profiles) && isRecord(item.profiles[0])
        ? item.profiles[0]
        : null;

    const candidate = candidates.get(studentId);
    const studentName =
      readString(joinedProfile?.name) ||
      readString(joinedProfile?.display_name) ||
      candidate?.displayName ||
      `Candidate ${studentId.slice(0, 8)}`;
    const studentEmail =
      readString(joinedProfile?.email) ||
      candidate?.email ||
      '';

    const aiScore = readNumber(item.original_ai_score) ?? effectiveScore;
    const aiConfidence = normalizeConfidence(resultRecord.ai_confidence ?? resultRecord.confidence);
    const overriddenAt = readString(item.score_overridden_at);

    return [{
      id,
      studentId,
      studentName,
      studentEmail,
      targetRole,
      aiScore: Math.min(100, Math.max(0, aiScore)),
      effectiveScore: Math.min(100, Math.max(0, effectiveScore)),
      aiConfidence,
      needsReview: aiConfidence !== null && aiConfidence < LOW_CONFIDENCE_THRESHOLD,
      completedAt: readString(item.completed_at) || readString(item.created_at),
      summary: readString(resultRecord.summary),
      transcript: normalizeTranscript(resultRecord.transcript ?? item.transcript),
      audioUrl: readHttpUrl(item.audio_url) ?? readHttpUrl(resultRecord.audio_url),
      rubric: normalizeRubric(resultRecord),
      override: overriddenAt ? {
        reason: readString(item.score_override_reason),
        facultyName: readString(item.score_overridden_by_name) || 'MSOT Staff',
        overriddenAt,
      } : null,
    }];
  });
}
