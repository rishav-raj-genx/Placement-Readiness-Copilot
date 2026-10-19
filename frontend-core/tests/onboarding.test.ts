import { describe, expect, it } from 'vitest';
import {
  MAX_PDF_BYTES,
  normalizeGithubUsername,
  signupAccountSchema,
  signupProfileSchema,
  validatePdf,
} from '@/lib/onboarding';

describe('three-step signup contracts', () => {
  it('requires a valid account identity and a strong password', () => {
    expect(signupAccountSchema.safeParse({ fullName: 'Asha Rao', email: 'asha@example.com', password: 'eight-chars' }).success).toBe(true);
    expect(signupAccountSchema.safeParse({ fullName: 'A', email: 'invalid', password: 'short' }).success).toBe(false);
  });

  it('normalizes and strictly validates GitHub identities', () => {
    expect(normalizeGithubUsername('https://github.com/octocat/?tab=repositories')).toBe('octocat');
    expect(normalizeGithubUsername('github.com/octocat')).toBe('octocat');
    expect(normalizeGithubUsername('@candidate')).toBe('candidate');
    expect(signupProfileSchema.parse({ targetRole: 'Frontend Engineer', github: 'https://github.com/octocat/' }).github).toBe('octocat');
    expect(signupProfileSchema.safeParse({ targetRole: 'Frontend Engineer', github: '-invalid-' }).success).toBe(false);
    expect(signupProfileSchema.safeParse({ targetRole: 'Frontend Engineer', github: 'invalid--name' }).success).toBe(false);
  });

  it('accepts only PDFs up to 10 MB', () => {
    expect(validatePdf(new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(validatePdf(new File(['text'], 'resume.txt', { type: 'text/plain' }))).toMatch(/PDF/);
    const oversized = new File([new Uint8Array(MAX_PDF_BYTES + 1)], 'resume.pdf', { type: 'application/pdf' });
    expect(validatePdf(oversized)).toMatch(/10 MB/);
  });
});
