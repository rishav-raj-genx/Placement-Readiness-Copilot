'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Code2, Sparkles, Terminal } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { CodingIDE } from '@/components/interview/coding-ide';
import { Button } from '@/components/ui/button';

export default function CodingInterviewPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/interview">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-white">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Interview Studio
          </Button>
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          <Sparkles className="h-3.5 w-3.5" /> Round 2: DSA + Web Development IDE Test
        </div>
      </div>

      <PageHeader
        title="Live Coding & Problem Solving Round"
        description="Write clean code, execute test cases, and compare your algorithm directly with the optimal benchmark evaluated by the AI Interviewer."
      />

      <CodingIDE />
    </div>
  );
}
