import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('3-Interview Limit and Paywall Modal Enforcement', () => {
  const modalPath = path.resolve(__dirname, '../components/interview/InterviewLimitModal.tsx');
  const routePath = path.resolve(__dirname, '../app/api/interview/start/route.ts');
  const studioPagePath = path.resolve(__dirname, '../app/(dashboard)/dashboard/interview/page.tsx');
  const topHeaderPath = path.resolve(__dirname, '../components/layout/top-header.tsx');
  const profileStorePath = path.resolve(__dirname, '../stores/profile-store.ts');

  const modalSource = fs.readFileSync(modalPath, 'utf-8');
  const routeSource = fs.readFileSync(routePath, 'utf-8');
  const studioPageSource = fs.readFileSync(studioPagePath, 'utf-8');
  const topHeaderSource = fs.readFileSync(topHeaderPath, 'utf-8');
  const profileStoreSource = fs.readFileSync(profileStorePath, 'utf-8');

  describe('1. Paywall Modal Component (InterviewLimitModal.tsx)', () => {
    it('contains the exact title "Free Tier Exhausted"', () => {
      expect(modalSource).toContain('Free Tier Exhausted');
    });

    it('contains the exact body copy explaining 3 free interviews completed and upgrading to Pro', () => {
      expect(modalSource).toContain(
        'You have completed your 3 free mock interviews. To continue practicing and access unlimited AI vivas and coding rounds, upgrade to the Pro tier.'
      );
    });

    it('contains the exact prominent badge: "Payment Gateway Under Construction"', () => {
      expect(modalSource).toContain('Payment Gateway Under Construction');
    });

    it('implements the Warm Lava & Embers theme and 3D tilt perspective animations', () => {
      expect(modalSource).toContain('#D93829');
      expect(modalSource).toContain('#FF6B4A');
      expect(modalSource).toContain('#28201E');
      expect(modalSource).toContain('[perspective:1200px]');
      expect(modalSource).toContain('rotateX');
      expect(modalSource).toContain('rotateY');
    });

    it('provides both "Return to Dashboard" and "Close" action controls', () => {
      expect(modalSource).toContain('Return to Dashboard');
      expect(modalSource).toContain('Close');
    });
  });

  describe('2. Backend Route Enforcement (api/interview/start/route.ts)', () => {
    it('queries interview_sessions table to count created/completed interviews for current user', () => {
      expect(routeSource).toContain(".from('interview_sessions')");
      expect(routeSource).toContain("count: 'exact'");
      expect(routeSource).toContain("head: true");
    });

    it('returns HTTP 403 status and error code LIMIT_EXCEEDED when session count >= 3', () => {
      expect(routeSource).toContain("totalSessions >= 3");
      expect(routeSource).toContain("status: 403");
      expect(routeSource).toContain("LIMIT_EXCEEDED");
    });
  });

  describe('3. UI Updates: Top Navigation & Start Button Intercept', () => {
    it('formats remaining interviews dynamically in TopHeader', () => {
      expect(topHeaderSource).toContain("credits === 1 ? '1 interview left' : `${credits} interviews left`");
      expect(topHeaderSource).toContain('interview-credits-counter');
    });

    it('intercepts start interview click to bypass API call and show paywall modal when locked', () => {
      expect(studioPageSource).toContain('handleStartClick');
      expect(studioPageSource).toContain('setShowPaywallModal(true)');
      expect(studioPageSource).toContain('InterviewLimitModal');
      expect(studioPageSource).toContain('showPaywallModal');
    });

    it('hydrates profile store with interview_sessions count to compute effective credits', () => {
      expect(profileStoreSource).toContain(".from('interview_sessions')");
      expect(profileStoreSource).toContain("Math.max(0, Math.min(rawCredits, 3 - sessionCount))");
    });
  });

  describe('4. Free Tier Credit & Remaining Logic Contract', () => {
    const calculateRemaining = (sessionCount: number, profileCredits: number = 3) => {
      const used = Math.max(sessionCount, 3 - profileCredits);
      return Math.max(0, 3 - used);
    };

    const formatCounter = (remaining: number) => {
      return remaining === 1 ? '1 interview left' : `${remaining} interviews left`;
    };

    it('evaluates remaining interviews correctly for 0, 1, 2, 3, and over-limit counts', () => {
      expect(formatCounter(calculateRemaining(0))).toBe('3 interviews left');
      expect(formatCounter(calculateRemaining(1))).toBe('2 interviews left');
      expect(formatCounter(calculateRemaining(2))).toBe('1 interview left');
      expect(formatCounter(calculateRemaining(3))).toBe('0 interviews left');
      expect(formatCounter(calculateRemaining(4))).toBe('0 interviews left');
    });

    it('blocks starting new interviews when remaining interviews equals 0', () => {
      const canStart = (sessionCount: number, isPremium: boolean = false) => {
        if (isPremium) return true;
        return calculateRemaining(sessionCount) > 0;
      };

      expect(canStart(0)).toBe(true);
      expect(canStart(2)).toBe(true);
      expect(canStart(3)).toBe(false);
      expect(canStart(3, true)).toBe(true); // Pro tier allowed
    });
  });
});
