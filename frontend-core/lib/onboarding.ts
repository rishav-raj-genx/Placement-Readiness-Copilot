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

export function validateResumeFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx');
  if (!isPdf && !isDocx) return 'Only PDF (.pdf) and Word (.docx) files are accepted.';
  if (file.size > MAX_PDF_BYTES) return 'Document files must be 10 MB or smaller.';
  return null;
}

export function sanitizeUsername(value: string | null | undefined): string {
  if (!value) return '';
  let str = value.trim();
  if (!str) return '';

  // Remove leading @ if present
  str = str.replace(/^@+/, '');

  // Strip query params and hashes, remove trailing slashes
  str = str.split(/[?#]/, 1)[0].replace(/\/+$/, '');

  // Extract from common URL patterns:
  // e.g. https://github.com/username or https://leetcode.com/username or https://leetcode.com/u/username
  const urlMatch = str.match(/(?:github\.com|leetcode\.(?:com|cn)(?:\/u)?)\/([a-zA-Z0-9_\-\.]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Handle generic http(s) URL where username is the last segment
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const parsed = new URL(str);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && /^[a-zA-Z0-9_\-\.]+$/.test(last)) {
        return last;
      }
    } catch {
      // Fall through to regex
    }
  }

  // If it's already a clean username or has prefix
  const cleaned = str.replace(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com|leetcode\.(?:com|cn))\/?/i, '');
  const segment = cleaned.replace(/^u\//i, '').split(/[/?#]/, 1)[0];
  return segment.replace(/^@+/, '').trim();
}

export function normalizeGithubUsername(value: string): string {
  return sanitizeUsername(value);
}

export const normalizeUsername = sanitizeUsername;
export const sanitizeGithubUsername = sanitizeUsername;
export const sanitizeLeetcodeUsername = sanitizeUsername;
