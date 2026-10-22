import { describe, expect, it } from 'vitest';
import { calculateLeetCodeScore, normalizeLeetCodeStats } from '@/lib/leetcode';

describe('LeetCode profile normalization', () => {
  it('reads solved counts from the current LeetCode GraphQL response', () => {
    const result = normalizeLeetCodeStats({
      data: {
        matchedUser: {
          username: 'candidate_205',
          submitStats: {
            acSubmissionNum: [
              { difficulty: 'All', count: 205 },
              { difficulty: 'Easy', count: 103 },
              { difficulty: 'Medium', count: 98 },
              { difficulty: 'Hard', count: 4 },
            ],
          },
          profile: { ranking: 12345 },
        },
        userContestRanking: { rating: 1580, globalRanking: 9000 },
      },
    });

    expect(result).toMatchObject({
      username: 'candidate_205',
      exists: true,
      total_solved: 205,
      easy_solved: 103,
      medium_solved: 98,
      hard_solved: 4,
      contest_rating: 1580,
      global_ranking: 9000,
    });
    expect(result?.score).toBeGreaterThan(0);
  });

  it('recalculates a stale zero score when solved counts are present', () => {
    const result = normalizeLeetCodeStats({
      username: 'active_candidate',
      exists: true,
      totalSolved: 240,
      easySolved: 110,
      mediumSolved: 115,
      hardSolved: 15,
      score: 0,
    });

    expect(result?.total_solved).toBe(240);
    expect(result?.score).toBe(calculateLeetCodeScore(240, 115, 15, null));
    expect(result?.score).toBeGreaterThan(0);
  });

  it('does not treat a missing GraphQL user as an existing account', () => {
    expect(normalizeLeetCodeStats({ data: { matchedUser: null } }, 'missing_user')).toMatchObject({
      username: 'missing_user',
      exists: false,
      total_solved: 0,
      score: 0,
    });
  });
});
