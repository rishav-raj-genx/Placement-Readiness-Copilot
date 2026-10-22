import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';
import { FALLBACK_CODING_PROBLEMS } from '@/lib/fallback-coding-problems';

describe('Auth Store Preview Mode & Hydration Fixes', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isPreview: true,
      isGuest: true,
      isHydrated: false,
      isLoading: false,
      error: null,
    });
  });

  it('initializes with isPreview: true and isGuest: true when unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isPreview).toBe(true);
    expect(state.isGuest).toBe(true);
    expect(state.user).toBeNull();
  });

  it('toggles isPreview: false and isGuest: false when user session is active', () => {
    const mockUser = {
      id: 'usr-456',
      email: 'alex@example.com',
      displayName: 'Alex Smith',
      role: 'student' as const,
      createdAt: new Date().toISOString(),
      targetLocations: [],
      skills: [],
      projects: [],
      targetRole: 'Frontend Engineer',
    };

    useAuthStore.setState({
      user: mockUser,
      isPreview: false,
      isGuest: false,
      isHydrated: true,
    });

    const state = useAuthStore.getState();
    expect(state.isPreview).toBe(false);
    expect(state.isGuest).toBe(false);
    expect(state.user?.id).toBe('usr-456');
    expect(state.user?.targetRole).toBe('Frontend Engineer');
  });
});

describe('Fallback Coding Problems Bank', () => {
  it('supplies resilient fallback coding problems with complete specs', () => {
    expect(FALLBACK_CODING_PROBLEMS.length).toBeGreaterThan(0);
    for (const prob of FALLBACK_CODING_PROBLEMS) {
      expect(prob.id).toBeTruthy();
      expect(prob.title).toBeTruthy();
      expect(prob.description).toBeTruthy();
      expect(prob.constraints.length).toBeGreaterThan(0);
      expect(prob.starter_code).toBeDefined();
      expect(prob.test_cases.length).toBeGreaterThan(0);
      expect(prob.optimal_time_complexity).toBeTruthy();
      expect(prob.optimal_space_complexity).toBeTruthy();
    }
  });

  it('contains both DSA and Web Development problem categories', () => {
    const categories = new Set(FALLBACK_CODING_PROBLEMS.map((p) => p.category));
    expect(categories.has('DSA')).toBe(true);
    expect(categories.has('Web Development')).toBe(true);
  });
});
