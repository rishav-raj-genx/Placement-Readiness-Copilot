import { NextResponse } from 'next/server';
import { normalizeGithubUsername } from '@/lib/onboarding';

export const runtime = 'nodejs';

export interface ExtractedIntent {
  targetRole?: string;
  github?: string;
  leetcodeUrl?: string;
  linkedinText?: string;
  linkedinUrl?: string;
  project?: {
    title: string;
    repoUrl?: string;
    liveUrl?: string;
    description: string;
  };
  displayName?: string;
}

export interface ParseIntentResponse {
  extracted: ExtractedIntent;
  reply: string;
}

const COMMON_ROLES = [
  'Full Stack Developer',
  'Full Stack Engineer',
  'Frontend Developer',
  'Frontend Engineer',
  'Backend Developer',
  'Backend Engineer',
  'Software Development Engineer',
  'Software Engineer',
  'DevOps Engineer',
  'Cloud Engineer',
  'Data Engineer',
  'Machine Learning Engineer',
  'Mobile Developer',
  'iOS Developer',
  'Android Developer',
  'Site Reliability Engineer',
  'Systems Engineer',
];

function extractWithHeuristics(
  message: string,
  current: Record<string, unknown> = {}
): ParseIntentResponse {
  const text = message.trim();
  const extracted: ExtractedIntent = {};

  // 1. GitHub Extraction
  const ghUrlMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_.-]+))?/i);
  const ghExplicitMatch = text.match(/(?:github|gh)[:\s]+@?([a-zA-Z0-9_-]+)/i);

  if (ghUrlMatch && !ghUrlMatch[2]) {
    extracted.github = normalizeGithubUsername(ghUrlMatch[1]);
  } else if (ghExplicitMatch) {
    extracted.github = normalizeGithubUsername(ghExplicitMatch[1]);
  }

  // 2. LeetCode / Coding Profile
  const lcMatch = text.match(
    /(https?:\/\/(?:www\.)?(?:leetcode\.com\/[^\s]+|hackerrank\.com\/[^\s]+|codeforces\.com\/[^\s]+|codechef\.com\/[^\s]+))/i
  );
  if (lcMatch) {
    extracted.leetcodeUrl = lcMatch[1];
  }

  // 3. LinkedIn URL or LinkedIn text
  const liMatch = text.match(/(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s]+)/i);
  if (liMatch) {
    extracted.linkedinUrl = liMatch[1];
    extracted.linkedinText = `LinkedIn Profile: ${liMatch[1]}`;
  } else if (/linkedin|about section|headline/i.test(text) && text.length > 50) {
    extracted.linkedinText = text;
  }

  // 4. Target Role
  const rolePrefixMatch = text.match(
    /(?:target(?:ing)?(?:\s+role)?|aspiring|role|position|interested in|looking for(?:\s+a)?|aiming for|want to be a|work as a)[\s:]+([A-Za-z0-9\s/+#.-]+?)(?=[,.]|\band\b|\bwith\b|\bmy\b|$)/i
  );
  if (rolePrefixMatch && rolePrefixMatch[1]) {
    const rawRole = rolePrefixMatch[1].trim();
    if (rawRole.length >= 3 && rawRole.length <= 40) {
      extracted.targetRole = rawRole;
    }
  }

  if (!extracted.targetRole) {
    for (const role of COMMON_ROLES) {
      if (new RegExp(`\\b${role}\\b`, 'i').test(text)) {
        extracted.targetRole = role;
        break;
      }
    }
  }

  // 5. Project Extraction
  const hasProjectKeywords = /project|repo|deployed|live url|built|portfolio/i.test(text);
  const repoMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+/i);
  const liveUrlMatch = text.match(/https?:\/\/(?!(?:www\.)?(?:github|leetcode|hackerrank|linkedin)\.com)[a-zA-Z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?/i);

  if (hasProjectKeywords && (repoMatch || liveUrlMatch)) {
    let title = 'Featured Project';
    if (repoMatch) {
      const parts = repoMatch[0].split('/');
      title = parts[parts.length - 1] || 'Featured Project';
    }
    extracted.project = {
      title,
      repoUrl: repoMatch ? repoMatch[0] : undefined,
      liveUrl: liveUrlMatch ? liveUrlMatch[0] : undefined,
      description: text.length > 20 ? text : `Project repository: ${repoMatch?.[0] ?? ''}`,
    };
  }

  // 6. Name Extraction (e.g. "My name is John Doe" or "I am Alice")
  const nameMatch = text.match(/(?:my name is|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch && nameMatch[1]) {
    extracted.displayName = nameMatch[1].trim();
  }

  // Compose friendly assistant reply
  const updates: string[] = [];
  if (extracted.displayName) updates.push(`your name as **${extracted.displayName}**`);
  if (extracted.targetRole) updates.push(`target role as **${extracted.targetRole}**`);
  if (extracted.github) updates.push(`GitHub profile as **@${extracted.github}**`);
  if (extracted.leetcodeUrl) updates.push(`coding profile as **${extracted.leetcodeUrl}**`);
  if (extracted.linkedinUrl || extracted.linkedinText) updates.push(`LinkedIn details`);
  if (extracted.project) updates.push(`project **${extracted.project.title}**`);

  let reply = '';
  if (updates.length > 0) {
    reply = `Got it! I've updated ${updates.join(', ')} ✅ in your live profile.`;
    const missing: string[] = [];
    if (!extracted.github && !current.github) missing.push('your GitHub profile URL');
    if (!extracted.targetRole && !current.targetRole) missing.push('your target role');
    if (!current.resumePath) missing.push('your resume (.pdf or .docx)');
    if (missing.length > 0) {
      reply += ` To further raise your Readiness Score, you can also share ${missing.slice(0, 2).join(' or ')}.`;
    } else {
      reply += ' Your profile is in great shape! You can review your dashboard whenever you are ready.';
    }
  } else {
    reply = "I received your message! You can provide your GitHub username, target role (e.g. 'Software Engineer'), LeetCode profile URL, or attach your resume (.pdf or .docx) using the button below.";
  }

  return { extracted, reply };
}

async function tryLlmExtraction(
  message: string,
  current: Record<string, unknown> = {}
): Promise<ParseIntentResponse | null> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const isGroq = Boolean(process.env.GROQ_API_KEY);
  const endpoint = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

  const systemPrompt = `You are an intake assistant for a placement readiness copilot.
Extract user information from their conversational message into structured JSON with this exact format:
{
  "extracted": {
    "targetRole": "Role name or null",
    "github": "clean GitHub username without @ or full URL, or null",
    "leetcodeUrl": "LeetCode/HackerRank URL or null",
    "linkedinText": "LinkedIn URL or bio text or null",
    "linkedinUrl": "LinkedIn URL or null",
    "displayName": "User full name or null",
    "project": {
      "title": "Project name or null",
      "repoUrl": "GitHub repo URL or null",
      "liveUrl": "Live deployed URL or null",
      "description": "Short description or null"
    }
  },
  "reply": "Concise, friendly 1-2 sentence assistant response acknowledging the extracted fields with green checkmark emojis and prompting for missing items (resume, github, role, projects)."
}
Do not output markdown codeblocks. Return valid JSON only.`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Current profile: ${JSON.stringify(current)}\nUser message: ${message}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as ParseIntentResponse;
    if (parsed.extracted && typeof parsed.reply === 'string') {
      if (parsed.extracted.github) {
        parsed.extracted.github = normalizeGithubUsername(parsed.extracted.github);
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message : '';
    const current = (typeof body?.current === 'object' && body.current !== null) ? body.current : {};

    if (!message.trim()) {
      return NextResponse.json({
        extracted: {},
        reply: "Please type a message or attach a resume to continue.",
      });
    }

    // Try LLM parsing first, fallback to heuristics
    const llmResult = await tryLlmExtraction(message, current);
    if (llmResult) {
      return NextResponse.json(llmResult);
    }

    const heuristicResult = extractWithHeuristics(message, current);
    return NextResponse.json(heuristicResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Intent parsing error: ${message}` },
      { status: 500 }
    );
  }
}
