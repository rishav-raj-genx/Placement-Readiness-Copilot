import type {
  LiveKitCategoryScore,
  LiveKitResultsPayload,
  LiveKitSuggestedFix,
  LiveKitTranscriptEntry,
} from '@/types';

type ResultRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ResultRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeCategory(value: unknown): LiveKitCategoryScore | null {
  if (!isRecord(value)) return null;
  return {
    category: readString(value.category, 'General'),
    score: readNumber(value.score),
    benchmark: readNumber(value.benchmark, 70),
    strengths: readStringArray(value.strengths),
    critiques: readStringArray(value.critiques),
  };
}

function normalizeSuggestedFix(value: unknown): LiveKitSuggestedFix | null {
  if (!isRecord(value)) return null;
  return {
    title: readString(value.title),
    location: readString(value.location, 'answers'),
    recommendedChange: readString(value.recommendedChange),
  };
}

function normalizeTranscriptEntry(entry: unknown, index: number): LiveKitTranscriptEntry | null {
  if (!isRecord(entry)) return null;
  const rawSpeaker = readString(entry.speaker || entry.role);
  const speaker: 'student' | 'interviewer' =
    rawSpeaker === 'student' || rawSpeaker === 'user' || rawSpeaker === 'candidate'
      ? 'student'
      : 'interviewer';
  const text = readString(entry.text || entry.message || entry.content);
  if (!text) return null;
  const timestamp = typeof entry.timestamp === 'number'
    ? entry.timestamp
    : (typeof entry.time === 'number' ? entry.time : Date.now());
  const id = readString(entry.id) || `transcript_${index}_${timestamp}`;
  return {
    id,
    speaker,
    text,
    timestamp,
    final: Boolean(entry.final ?? true),
  };
}

/** Normalizes canonical v0 and LiveKit event result payloads. */
export function normalizeInterviewResult(value: unknown): LiveKitResultsPayload {
  if (!isRecord(value)) {
    return {
      overallReadinessDelta: 0,
      finalScore: 0,
      summary: '',
      categoryScores: [],
      suggestedFixes: [],
      timestamp: Date.now(),
    };
  }

  const finalScore = typeof value.interview_score === 'number'
    ? value.interview_score
    : readNumber(value.finalScore);
  const categoryScores: LiveKitCategoryScore[] = [];

  if (isRecord(value.dimensions)) {
    const dimensionLabels: Record<string, string> = {
      technical_depth: 'Technical depth',
      communication: 'Communication clarity',
      behavioral: 'Behavioral & Leadership',
    };

    for (const [key, dimension] of Object.entries(value.dimensions)) {
      if (!isRecord(dimension)) continue;
      categoryScores.push({
        category: dimensionLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
        score: readNumber(dimension.score),
        benchmark: 70,
        strengths: readStringArray(dimension.strengths),
        critiques: readStringArray(dimension.improvement_areas),
      });
    }
  }

  if (categoryScores.length === 0 && Array.isArray(value.categoryScores)) {
    categoryScores.push(
      ...value.categoryScores
        .map(normalizeCategory)
        .filter((category): category is LiveKitCategoryScore => category !== null)
    );
  }

  const suggestedFixes = Array.isArray(value.suggestedFixes)
    ? value.suggestedFixes
        .map(normalizeSuggestedFix)
        .filter((fix): fix is LiveKitSuggestedFix => fix !== null)
    : [];

  const isFallback = Boolean(value.is_fallback ?? value.isFallback);
  const evaluationMode = readString(value.evaluation_mode ?? value.evaluationMode);
  const rubricVersion = readString(value.rubric_version ?? value.rubricVersion);
  const isProvisional = Boolean(value.is_provisional ?? value.isProvisional ?? isFallback);

  let rawTranscriptList: unknown[] = [];
  if (Array.isArray(value.transcript)) {
    rawTranscriptList = value.transcript;
  } else if (Array.isArray(value.transcripts)) {
    rawTranscriptList = value.transcripts;
  } else if (isRecord(value.result)) {
    if (Array.isArray(value.result.transcript)) {
      rawTranscriptList = value.result.transcript;
    } else if (Array.isArray(value.result.transcripts)) {
      rawTranscriptList = value.result.transcripts;
    }
  }

  const transcript = rawTranscriptList
    .map((entry, index) => normalizeTranscriptEntry(entry, index))
    .filter((entry): entry is LiveKitTranscriptEntry => entry !== null);

  return {
    overallReadinessDelta: readNumber(value.overallReadinessDelta),
    finalScore,
    summary: readString(value.summary),
    categoryScores,
    suggestedFixes,
    timestamp: readNumber(value.timestamp, Date.now()),
    isFallback,
    evaluationMode,
    rubricVersion,
    isProvisional,
    transcript: transcript.length > 0 ? transcript : undefined,
  };
}
