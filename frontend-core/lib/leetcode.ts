export interface LeetCodeStats {
  username: string;
  exists: boolean;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating: number | null;
  global_ranking: number | null;
  score: number;
  error: string | null;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function calculateLeetCodeScore(
  totalSolved: number,
  mediumSolved: number,
  hardSolved: number,
  contestRating: number | null,
): number {
  if (totalSolved <= 0) return 0;
  const mediumAndHard = mediumSolved + hardSolved;
  if (totalSolved >= 300 && mediumAndHard >= 150) return 100;

  const volumeScore = Math.min(70, (totalSolved / 300) * 70);
  const qualityScore = Math.min(25, (mediumAndHard / 150) * 20 + Math.min(5, hardSolved / 4));
  const contestBonus = contestRating !== null && contestRating > 0
    ? contestRating >= 1850
      ? 15
      : contestRating >= 1650
        ? 10
        : contestRating >= 1500
          ? 5
          : 0
    : hardSolved >= 25
      ? 10
      : hardSolved >= 10
        ? 5
        : 0;

  return Math.min(100, Math.max(0, Math.round(volumeScore + qualityScore + contestBonus)));
}

function readSubmissionCounts(value: unknown): {
  total: number;
  easy: number;
  medium: number;
  hard: number;
} {
  const counts = { total: 0, easy: 0, medium: 0, hard: 0 };
  if (!Array.isArray(value)) return counts;

  for (const item of value) {
    if (!isRecord(item)) continue;
    const difficulty = readString(item.difficulty).toLowerCase();
    const count = Math.max(0, Math.round(readNumber(item.count) ?? 0));
    if (difficulty === 'all') counts.total = count;
    else if (difficulty === 'easy') counts.easy = count;
    else if (difficulty === 'medium') counts.medium = count;
    else if (difficulty === 'hard') counts.hard = count;
  }

  if (counts.total === 0) counts.total = counts.easy + counts.medium + counts.hard;
  return counts;
}

/** Normalizes the profile service, common third-party APIs, and raw LeetCode GraphQL. */
export function normalizeLeetCodeStats(value: unknown, fallbackUsername = ''): LeetCodeStats | null {
  if (!isRecord(value)) return null;

  const rootData = isRecord(value.data) ? value.data : value;
  const matchedUser = isRecord(rootData.matchedUser) ? rootData.matchedUser : null;
  const profile = matchedUser && isRecord(matchedUser.profile) ? matchedUser.profile : {};
  const contest = isRecord(rootData.userContestRanking)
    ? rootData.userContestRanking
    : isRecord(value.contestRanking)
      ? value.contestRanking
      : {};
  const submitStats = matchedUser && isRecord(matchedUser.submitStats)
    ? matchedUser.submitStats
    : matchedUser && isRecord(matchedUser.submitStatsGlobal)
      ? matchedUser.submitStatsGlobal
      : isRecord(value.submitStats)
        ? value.submitStats
        : isRecord(value.submitStatsGlobal)
          ? value.submitStatsGlobal
          : {};
  const submissionCounts = readSubmissionCounts(submitStats.acSubmissionNum);

  const easySolved = Math.max(0, Math.round(readNumber(
    value.easy_solved,
    value.easySolved,
    submissionCounts.easy,
  ) ?? 0));
  const mediumSolved = Math.max(0, Math.round(readNumber(
    value.medium_solved,
    value.mediumSolved,
    submissionCounts.medium,
  ) ?? 0));
  const hardSolved = Math.max(0, Math.round(readNumber(
    value.hard_solved,
    value.hardSolved,
    submissionCounts.hard,
  ) ?? 0));
  const totalSolved = Math.max(0, Math.round(readNumber(
    value.total_solved,
    value.totalSolved,
    submissionCounts.total,
  ) ?? easySolved + mediumSolved + hardSolved));
  const contestRating = readNumber(value.contest_rating, value.contestRating, contest.rating);
  const globalRanking = readNumber(
    value.global_ranking,
    value.globalRanking,
    contest.globalRanking,
    profile.ranking,
    value.ranking,
  );
  const username = readString(value.username, matchedUser?.username, fallbackUsername);
  const explicitExists = typeof value.exists === 'boolean' ? value.exists : null;
  const hasMatchedUserField = 'matchedUser' in rootData;
  const exists = explicitExists ?? (hasMatchedUserField
    ? matchedUser !== null
    : Boolean(username || totalSolved > 0));
  const explicitScore = readNumber(value.score);
  const calculatedScore = calculateLeetCodeScore(totalSolved, mediumSolved, hardSolved, contestRating);

  if (!exists && !username && totalSolved === 0 && !('exists' in value) && !('matchedUser' in rootData)) {
    return null;
  }

  return {
    username,
    exists,
    total_solved: totalSolved,
    easy_solved: easySolved,
    medium_solved: mediumSolved,
    hard_solved: hardSolved,
    contest_rating: contestRating,
    global_ranking: globalRanking === null ? null : Math.round(globalRanking),
    score: explicitScore === null || (explicitScore === 0 && totalSolved > 0)
      ? calculatedScore
      : Math.min(100, Math.max(0, Math.round(explicitScore))),
    error: typeof value.error === 'string' && value.error.trim() ? value.error.trim() : null,
  };
}
