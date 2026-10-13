import type { LiveKitResultsPayload, LiveKitCategoryScore, LiveKitSuggestedFix } from '@/types';

/**
 * Normalizes an interview_sessions.result JSONB payload into LiveKitResultsPayload.
 * Supports both:
 * 1. Canonical v0 schema (with contract_version, interview_score, dimensions, transcript)
 * 2. LiveKit event schema (with finalScore, categoryScores, overallReadinessDelta)
 */
export function normalizeInterviewResult(result: any): LiveKitResultsPayload {
  if (!result || typeof result !== 'object') {
    return {
      overallReadinessDelta: 0,
      finalScore: 0,
      summary: '',
      categoryScores: [],
      suggestedFixes: [],
      timestamp: Date.now(),
    };
  }

  // Determine final score: interview_score (v0) takes precedence, fallback to finalScore
  const finalScore =
    typeof result.interview_score === 'number'
      ? result.interview_score
      : typeof result.finalScore === 'number'
      ? result.finalScore
      : 0;

  const summary = typeof result.summary === 'string' ? result.summary : '';
  const overallReadinessDelta =
    typeof result.overallReadinessDelta === 'number' ? result.overallReadinessDelta : 0;

  // Build categoryScores
  let categoryScores: LiveKitCategoryScore[] = [];

  // Check if dimensions exists (canonical v0)
  if (result.dimensions && typeof result.dimensions === 'object') {
    const dimLabels: Record<string, string> = {
      technical_depth: 'Technical depth',
      communication: 'Communication clarity',
      behavioral: 'Behavioral & Leadership',
    };

    for (const [key, dim] of Object.entries<any>(result.dimensions)) {
      if (!dim || typeof dim !== 'object') continue;
      categoryScores.push({
        category: dimLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        score: typeof dim.score === 'number' ? dim.score : 0,
        benchmark: 70,
        strengths: Array.isArray(dim.strengths) ? dim.strengths : [],
        critiques: Array.isArray(dim.improvement_areas) ? dim.improvement_areas : [],
      });
    }
  }

  // If no dimensions were found, check if categoryScores array exists
  if (categoryScores.length === 0 && Array.isArray(result.categoryScores)) {
    categoryScores = result.categoryScores.map((cs: any) => ({
      category: typeof cs?.category === 'string' ? cs.category : 'General',
      score: typeof cs?.score === 'number' ? cs.score : 0,
      benchmark: typeof cs?.benchmark === 'number' ? cs.benchmark : 70,
      strengths: Array.isArray(cs?.strengths) ? cs.strengths : [],
      critiques: Array.isArray(cs?.critiques) ? cs.critiques : [],
    }));
  }

  // Build suggestedFixes
  let suggestedFixes: LiveKitSuggestedFix[] = [];
  if (Array.isArray(result.suggestedFixes)) {
    suggestedFixes = result.suggestedFixes.map((sf: any) => ({
      title: typeof sf?.title === 'string' ? sf.title : '',
      location: typeof sf?.location === 'string' ? sf.location : 'answers',
      recommendedChange: typeof sf?.recommendedChange === 'string' ? sf.recommendedChange : '',
    }));
  }

  const timestamp = typeof result.timestamp === 'number' ? result.timestamp : Date.now();

  return {
    overallReadinessDelta,
    finalScore,
    summary,
    categoryScores,
    suggestedFixes,
    timestamp,
  };
}
