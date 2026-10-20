import { NextResponse } from 'next/server';
import { POST as analyzeHandler } from '@/app/api/profile-review/analyze/route';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  return analyzeHandler(request);
}
