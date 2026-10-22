import { NextRequest, NextResponse } from 'next/server';
import { createServerSessionClient } from '@/lib/supabase-session-server';
import { getAutomationBaseUrl, serviceRequest } from '@/lib/backend-services';
import { normalizeUserProfile, PROFILE_SELECT_COLUMNS } from '@/lib/profile-adapters';

interface ProjectCheckBody {
  projectId?: string;
  liveUrl?: string;
  projectName?: string;
  claims?: string[] | string;
  description?: string;
}

export const runtime = 'nodejs';
export const maxDuration = 60;

const KNOWN_TECH_PATTERNS = [
  'react', 'next.js', 'nextjs', 'tailwind', 'tailwindcss', 'typescript', 'javascript',
  'python', 'fastapi', 'django', 'flask', 'node', 'nodejs', 'express',
  'postgres', 'postgresql', 'mongodb', 'mysql', 'sqlite', 'redis',
  'graphql', 'rest', 'docker', 'kubernetes', 'aws', 'firebase', 'supabase',
  'auth', 'oauth', 'jwt', 'prisma', 'drizzle', 'vite', 'redux', 'zustand',
  'playwright', 'vitest', 'jest', 'webrtc', 'websocket',
];

function extractProjectClaims(description?: string, explicitClaims?: string[] | string): string[] {
  if (Array.isArray(explicitClaims) && explicitClaims.length > 0) {
    return explicitClaims.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof explicitClaims === 'string' && explicitClaims.trim().length > 0) {
    return explicitClaims.split(/[,;\n]+/).map((c) => c.trim()).filter(Boolean);
  }

  if (!description) return [];

  const lowerDesc = description.toLowerCase();
  const matched: string[] = [];

  for (const tech of KNOWN_TECH_PATTERNS) {
    const regex = new RegExp(`\\b${tech.replace('.', '\\.')}\\b`, 'i');
    if (regex.test(lowerDesc)) {
      matched.push(tech);
    }
  }

  // Also extract any comma-delimited items or hashtags if present
  const commaMatches = description.match(/\b[A-Z][a-zA-Z0-9.+]{2,}\b/g);
  if (commaMatches) {
    for (const word of commaMatches.slice(0, 10)) {
      const w = word.trim();
      if (w.length > 2 && !matched.some((m) => m.toLowerCase() === w.toLowerCase())) {
        matched.push(w);
      }
    }
  }

  return matched.slice(0, 15);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => null)) as ProjectCheckBody | null;
    const supabase = createServerSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let targetUrl = body?.liveUrl?.trim();
    let targetName = body?.projectName?.trim() || 'Project Submission';
    let targetDescription = body?.description?.trim();

    if (body?.projectId) {
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', user.id)
        .single();
      const profile = normalizeUserProfile(data as unknown);
      const project = profile?.projects.find((item) => item.id === body.projectId);
      if (project) {
        targetUrl = targetUrl || project.liveUrl;
        targetName = targetName || project.name || project.title || 'Project Submission';
        targetDescription = targetDescription || project.description;
      }
    }

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'A valid live URL is required for verification.' },
        { status: 400 },
      );
    }

    // Specific project claims, NOT general profile skills
    const projectClaims = extractProjectClaims(targetDescription, body?.claims);

    const payload = await serviceRequest(`${getAutomationBaseUrl()}/api/link-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        student_id: user.id,
        project_name: targetName,
        claimed_keywords: projectClaims,
      }),
      timeoutMs: 45_000,
    });

    const record = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
    const contentEval = (typeof record.content_evaluation === 'object' && record.content_evaluation !== null ? record.content_evaluation : {}) as Record<string, unknown>;

    const normalized = {
      ...record,
      passed: Boolean(record.passed),
      isLive: Boolean(record.is_live ?? record.isLive),
      qualityScore: Number(record.quality_score ?? record.qualityScore ?? 0),
      claimsMatched: typeof contentEval.claims_matched === 'boolean'
        ? contentEval.claims_matched
        : (typeof record.claimsMatched === 'boolean' ? record.claimsMatched : true),
      recommendations: Array.isArray(record.recommendations) ? record.recommendations : [],
    };

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Project check failed.' },
      { status: 502 },
    );
  }
}
