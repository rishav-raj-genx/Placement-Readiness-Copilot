import type { ProjectItem } from '@/types';
import { normalizeGithubUsername } from './onboarding';

export interface ExtractedIntent {
  targetRole?: string;
  github?: string;
  leetcodeUrl?: string;
  linkedinText?: string;
  linkedinUrl?: string;
  project?: ProjectItem;
  displayName?: string;
}

export interface ParseIntentResult {
  extracted: ExtractedIntent;
  reply: string;
}

export async function parseConversationalIntent(
  message: string,
  current: {
    targetRole?: string;
    github?: string;
    leetcodeUrl?: string;
    linkedinText?: string;
    resumePath?: string | null;
    projectsCount?: number;
  }
): Promise<ParseIntentResult> {
  try {
    const res = await fetch('/api/profile/parse-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, current }),
    });
    if (res.ok) {
      const data = (await res.json()) as ParseIntentResult;
      return data;
    }
  } catch {
    // Graceful fallback to client-side heuristics if network error
  }

  // Client-side instant regex fallback
  const text = message.trim();
  const extracted: ExtractedIntent = {};

  const ghUrlMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  const ghExplicitMatch = text.match(/(?:github|gh)[:\s]+@?([a-zA-Z0-9_-]+)/i);
  if (ghUrlMatch) extracted.github = normalizeGithubUsername(ghUrlMatch[1]);
  else if (ghExplicitMatch) extracted.github = normalizeGithubUsername(ghExplicitMatch[1]);

  const lcMatch = text.match(/(https?:\/\/(?:www\.)?(?:leetcode|hackerrank|codeforces)\.com\/[^\s]+)/i);
  if (lcMatch) extracted.leetcodeUrl = lcMatch[1];

  const liMatch = text.match(/(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s]+)/i);
  if (liMatch) {
    extracted.linkedinUrl = liMatch[1];
    extracted.linkedinText = `LinkedIn Profile: ${liMatch[1]}`;
  }

  const roleMatch = text.match(
    /(?:target(?:ing)?(?:\s+role)?|aspiring|role|position|interested in|looking for(?:\s+a)?|aiming for|want to be a|work as a)[\s:]+([A-Za-z0-9\s/+#.-]+?)(?=[,.]|\band\b|\bwith\b|\bmy\b|\broles?\b|$)/i
  );
  if (roleMatch && roleMatch[1]) {
    const raw = roleMatch[1].trim();
    if (raw.length >= 3) extracted.targetRole = raw;
  }

  if (!extracted.targetRole) {
    const commonRoles = [
      'Full Stack Developer',
      'Full Stack Engineer',
      'Frontend Developer',
      'Frontend Engineer',
      'Backend Developer',
      'Backend Engineer',
      'Software Development Engineer',
      'Software Engineer',
      'DevOps Engineer',
      'Data Engineer',
      'Machine Learning Engineer',
    ];
    for (const role of commonRoles) {
      if (new RegExp(`\\b${role}\\b`, 'i').test(text)) {
        extracted.targetRole = role;
        break;
      }
    }
  }

  return {
    extracted,
    reply: 'Understood! I have captured your details and updated your profile in real-time.',
  };
}
