import { z } from 'zod';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const githubUsernamePattern = /^(?!.*--)[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export const signupAccountSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export const signupProfileSchema = z.object({
  targetRole: z.string().trim().min(2, 'Target role is required.'),
  github: z.string().trim().transform(normalizeGithubUsername).pipe(
    z.string().regex(githubUsernamePattern, 'Enter a valid GitHub username or profile URL.'),
  ),
});

export type SignupAccountValues = z.infer<typeof signupAccountSchema>;
export type SignupProfileValues = z.input<typeof signupProfileSchema>;
export type NormalizedSignupProfile = z.output<typeof signupProfileSchema>;

export function validatePdf(file: File): string | null {
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  if (file.type !== 'application/pdf' && !hasPdfExtension) return 'Only PDF files are accepted.';
  if (file.size > MAX_PDF_BYTES) return 'PDF files must be 10 MB or smaller.';
  return null;
}

export function normalizeGithubUsername(value: string): string {
  const withoutPrefix = value
    .trim()
    .replace(/^@/, '')
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');

  return withoutPrefix.split(/[/?#]/, 1)[0] ?? '';
}

export const normalizeUsername = normalizeGithubUsername;
