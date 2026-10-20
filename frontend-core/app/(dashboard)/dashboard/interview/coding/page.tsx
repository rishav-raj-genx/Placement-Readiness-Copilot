'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Code2, Lock, Mic2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { CodingIDE } from '@/components/interview/coding-ide';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { checkRound1Completed } from '@/lib/round-status';

export default function CodingInterviewPage() {
  const user = useAuthStore((state) => state.user);
  const [isRound1Done, setIsRound1Done] = useState<boolean | null>(null);

  useEffect(() => {
    void checkRound1Completed(user?.id).then((done) => setIsRound1Done(done));
  }, [user?.id]);

  if (isRound1Done === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse font-mono text-xs text-stone-500">
          Checking interview status...
        </div>
      </div>
    );
  }

  if (!isRound1Done) {
    return (
      <div className="mx-auto max-w-2xl pt-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/interview">
            <Button variant="ghost" size="sm" className="text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to interview studio
            </Button>
          </Link>
        </div>

        <Card className="border-amber-500/30 bg-[#28201E] shadow-2xl text-center">
          <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Lock className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-300">
                Prerequisite Required
              </span>
              <h2 className="text-2xl font-bold text-stone-100">Round 2 Coding IDE is Locked</h2>
              <p className="text-sm text-stone-400 max-w-md mx-auto leading-relaxed">
                In accordance with the two-round placement evaluation system, you must successfully complete <strong className="text-stone-100">Round 1: Technical & Architectural Viva</strong> before unlocking the live coding test and IDE examination.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard/interview">
                <Button className="bg-[#D93829] hover:bg-[#C22F21] text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg">
                  <Mic2 className="mr-2 h-4 w-4" /> Start Round 1: Technical Viva
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="border-stone-800 text-stone-300 hover:bg-stone-800 rounded-xl">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/interview">
          <Button variant="ghost" size="sm" className="text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to interview studio
          </Button>
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-400">
          <Code2 className="h-3.5 w-3.5" /> Round 2: DSA + web dev IDE · Active
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
