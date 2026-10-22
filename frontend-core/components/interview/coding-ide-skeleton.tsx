'use client';

import React from 'react';
import { Loader2, Sparkles, Terminal } from 'lucide-react';

export function CodingIDESkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading coding challenge workspace">
      {/* Category Pills & Progress Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-28 rounded-full bg-stone-800/60" />
          <div className="h-7 w-32 rounded-full bg-stone-800/40" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-32 rounded-xl bg-stone-800/50" />
          <div className="h-9 w-40 rounded-xl bg-red-950/30 border border-red-900/30" />
        </div>
      </div>

      {/* Problem Selection Pills Skeleton */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-9 w-44 rounded-xl bg-stone-800/60 border border-stone-700/50" />
        <div className="h-9 w-40 rounded-xl bg-stone-800/40 border border-stone-800/50" />
        <div className="h-9 w-48 rounded-xl bg-stone-800/40 border border-stone-800/50" />
      </div>

      {/* Main Grid: Left Problem Spec Skeleton + Right Editor Skeleton */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (5 cols): Problem Spec */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-stone-800 bg-stone-900 overflow-hidden shadow-xl shadow-black/40 min-h-[580px]">
          {/* Tab Header Skeleton */}
          <div className="flex border-b border-stone-800 bg-stone-950 p-1.5 gap-1.5">
            <div className="h-8 flex-1 rounded-xl bg-stone-800/80" />
            <div className="h-8 flex-1 rounded-xl bg-stone-900/50" />
          </div>

          <div className="p-6 space-y-5">
            {/* Title & Badge */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="space-y-1.5">
                <div className="h-5 w-48 rounded-md bg-stone-700/60" />
                <div className="h-3 w-24 rounded bg-stone-800" />
              </div>
              <div className="h-6 w-16 rounded-md bg-stone-800/80" />
            </div>

            {/* Description Lines */}
            <div className="space-y-2.5 pt-1">
              <div className="h-3.5 w-full rounded bg-stone-800/70" />
              <div className="h-3.5 w-11/12 rounded bg-stone-800/60" />
              <div className="h-3.5 w-4/5 rounded bg-stone-800/50" />
              <div className="h-3.5 w-5/6 rounded bg-stone-800/60" />
            </div>

            {/* Constraints Card */}
            <div className="rounded-xl border border-stone-800/80 bg-stone-950/60 p-4 space-y-2">
              <div className="h-3 w-24 rounded bg-stone-700/60" />
              <div className="h-3 w-3/4 rounded bg-stone-800/60" />
              <div className="h-3 w-2/3 rounded bg-stone-800/60" />
            </div>

            {/* Target Complexity */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="h-14 rounded-xl border border-stone-800 bg-stone-950/60" />
              <div className="h-14 rounded-xl border border-stone-800 bg-stone-950/60" />
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): IDE Skeleton with Branded Warm Lava Spinner */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-stone-800 bg-stone-950 overflow-hidden shadow-2xl shadow-black/60 min-h-[580px]">
          {/* Editor Header */}
          <div className="flex items-center justify-between border-b border-stone-800 bg-stone-900/90 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#D93829]" />
              <div className="h-4 w-28 rounded bg-stone-800" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-24 rounded-lg bg-stone-800" />
              <div className="h-7 w-20 rounded-lg bg-stone-800" />
            </div>
          </div>

          {/* Code Editor Body with Centered Warm Lava Spinner */}
          <div className="relative flex-1 min-h-[420px] flex flex-col items-center justify-center p-8 bg-[#1a1310]/95 overflow-hidden">
            {/* Background glowing lava aura */}
            <div className="absolute inset-0 bg-gradient-radial from-[#D93829]/15 via-orange-950/10 to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
              {/* Branded Warm Lava Spinner */}
              <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-[#28201E] shadow-xl shadow-red-950/50">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#D93829]/25 via-orange-500/20 to-amber-500/10 animate-pulse" />
                <Loader2 className="h-8 w-8 animate-spin text-[#D93829]" />
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-mono font-semibold text-orange-400 mb-2">
                <Sparkles className="h-3 w-3 text-[#D93829]" />
                <span>Generating Coding Assessment</span>
              </div>

              <h3 className="text-base font-bold text-stone-100">
                Loading Round 2 Challenge Bank
              </h3>
              <p className="mt-1 text-xs text-stone-400 leading-relaxed">
                Calibrating optimal algorithm specifications, starter templates, and proctored execution sandbox...
              </p>
            </div>

            {/* Shimmering simulated code lines in background */}
            <div className="w-full mt-6 space-y-2 opacity-20 pointer-events-none font-mono text-xs">
              <div className="h-3 w-1/3 rounded bg-orange-400" />
              <div className="h-3 w-1/2 rounded bg-stone-500 pl-4" />
              <div className="h-3 w-2/3 rounded bg-stone-400 pl-8" />
              <div className="h-3 w-1/4 rounded bg-stone-500" />
            </div>
          </div>

          {/* Bottom Execution Bar */}
          <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/80 px-4 py-3">
            <div className="h-6 w-32 rounded bg-stone-800" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-24 rounded-xl bg-stone-800" />
              <div className="h-8 w-28 rounded-xl bg-red-950/40 border border-red-900/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
