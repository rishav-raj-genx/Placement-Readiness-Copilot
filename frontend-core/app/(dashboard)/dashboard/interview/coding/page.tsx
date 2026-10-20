'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Code2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { CodingIDE } from '@/components/interview/coding-ide';
import { Button } from '@/components/ui/button';

export default function CodingInterviewPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/interview">
          <Button variant="ghost" size="sm" className="text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to interview studio
          </Button>
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-stone-400">
          <Code2 className="h-3.5 w-3.5 text-stone-400" /> Round 2: DSA + web dev IDE
        </div>
      </div>

      <PageHeader
        title="Coding & problem solving"
        description="Write clean code, execute test cases, and compare your algorithm directly with the optimal benchmark."
      />

      <CodingIDE />
    </div>
  );
}
