import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProfileStore } from '@/stores/profile-store';

describe('profile re-evaluation request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useProfileStore.getState().reset();
  });

  it('forces a refresh and maps the returned review before hydrating persisted state', async () => {
    const hydrate = vi.fn(async () => {
      expect(useProfileStore.getState().readiness?.totalScore).toBe(74);
      expect(useProfileStore.getState().review?.status).toBe('completed');
    });
    useProfileStore.setState({ hydrate });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      success: true,
      review: { scores: { resume: 80 } },
      readiness: {
        student_id: 'candidate-1',
        total_score: 74,
        readiness_level: 'Almost ready',
        breakdown: {},
        top_actions: [],
        updated_at: '2026-10-22T10:00:00.000Z',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useProfileStore.getState().analyze('candidate-1');

    expect(result).toBe(true);
    expect(hydrate).toHaveBeenCalledWith('candidate-1');
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit?.body).toEqual(expect.any(String));
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      userId: 'candidate-1',
      force_refresh: true,
    });
    expect(useProfileStore.getState().isAnalyzing).toBe(false);
  });

  it('preserves successful review state when background hydrate throws', async () => {
    const hydrate = vi.fn(async () => {
      throw new Error('Supabase network error during hydration');
    });
    useProfileStore.setState({ hydrate });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      success: true,
      review: { scores: { resume: 85 } },
      readiness: {
        student_id: 'candidate-2',
        total_score: 82,
        readiness_level: 'Placement ready',
        breakdown: {},
        top_actions: [],
        updated_at: '2026-10-22T12:00:00.000Z',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useProfileStore.getState().analyze('candidate-2');

    expect(result).toBe(true);
    expect(useProfileStore.getState().readiness?.totalScore).toBe(82);
    expect(useProfileStore.getState().review?.status).toBe('completed');
    expect(useProfileStore.getState().isAnalyzing).toBe(false);
  });
});
