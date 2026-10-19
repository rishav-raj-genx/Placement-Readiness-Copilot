'use client';

import React from 'react';
import Link from 'next/link';
import {
  Mic2,
  Play,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  History,
  FileAudio,
} from 'lucide-react';

interface SessionItem {
  id: string;
  role: string;
  date: string;
  duration: string;
  score: number;
  status: 'Completed' | 'Analyzing';
  feedbackSummary: string;
  topStrengths: string[];
  improvementArea: string;
}

const PAST_SESSIONS: SessionItem[] = [
  {
    id: 'session-101',
    role: 'Full-Stack SDE (Node.js & React)',
    date: 'Yesterday, 4:30 PM',
    duration: '14 min 42 sec',
    score: 88,
    status: 'Completed',
    feedbackSummary:
      'Clear explanation of microservices communication and Redis caching. Handled concurrency trade-offs calmly.',
    topStrengths: ['System Design Concepts', 'React Concurrency', 'STAR Method Delivery'],
    improvementArea: 'Dive deeper into optimistic concurrency control and distributed transactions.',
  },
  {
    id: 'session-100',
    role: 'Frontend Engineering Core (Next.js & Web Vitals)',
    date: '3 days ago',
    duration: '15 min 10 sec',
    score: 82,
    status: 'Completed',
    feedbackSummary:
      'Strong understanding of Server Components and hydration boundaries. Pacing was confident.',
    topStrengths: ['Next.js App Router', 'Cumulative Layout Shift (CLS) Debugging'],
    improvementArea: 'Be concise during browser rendering pipeline questions (FCP / LCP).',
  },
];

export default function InterviewsPage() {
  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
            <Mic2 className="h-3.5 w-3.5" />
            <span>AI VOICE STUDIO</span>
          </div>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Interview History & Feedback
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Review your past AI mock vivas, audio transcripts, and technical depth scores.
          </p>
        </div>

        <Link
          href="/interview/configure"
          className="group flex items-center gap-2 self-start rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 px-5 py-3 font-[var(--font-display)] text-xs font-bold text-white shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all hover:scale-[1.02] sm:self-auto"
        >
          <Play className="h-4 w-4 fill-white" />
          <span>Launch New AI Viva</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#0E1524]/70 p-5 backdrop-blur-xl">
          <p className="font-mono text-xs text-white/50">TOTAL SESSIONS COMPLETED</p>
          <p className="mt-2 font-[var(--font-display)] text-3xl font-extrabold text-white">2</p>
          <p className="mt-1 text-xs text-emerald-400">1 free session remaining this week</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0E1524]/70 p-5 backdrop-blur-xl">
          <p className="font-mono text-xs text-white/50">AVERAGE TECHNICAL VIVA SCORE</p>
          <p className="mt-2 font-[var(--font-display)] text-3xl font-extrabold text-cyan-400">85%</p>
          <p className="mt-1 text-xs text-white/50">Top 12% among candidate peers</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0E1524]/70 p-5 backdrop-blur-xl">
          <p className="font-mono text-xs text-white/50">AGENT RESPONSE LATENCY</p>
          <p className="mt-2 font-[var(--font-display)] text-3xl font-extrabold text-indigo-400">
            118 ms
          </p>
          <p className="mt-1 text-xs text-white/50">Bidirectional LiveKit audio stream</p>
        </div>
      </div>

      {/* Past Sessions List */}
      <div className="space-y-4">
        <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
          Completed Sessions
        </h2>

        {PAST_SESSIONS.map((session) => (
          <div
            key={session.id}
            className="rounded-3xl border border-white/10 bg-[#101827]/80 p-6 shadow-xl backdrop-blur-xl transition-colors hover:border-white/20 sm:p-7"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400">
                  {session.role}
                </span>
                <h3 className="mt-1 font-[var(--font-display)] text-lg font-bold text-white">
                  15-Minute Mock Technical Interview
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-white/40 font-mono">
                  <span>{session.date}</span>
                  <span>•</span>
                  <span>{session.duration}</span>
                </div>
              </div>

              {/* Score badge */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-right">
                  <span className="font-mono text-2xl font-black text-emerald-400">
                    {session.score}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-300/70">
                    READINESS SCORE
                  </span>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <p className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-white/70">
              <strong className="text-white">AI Evaluator Summary:</strong> {session.feedbackSummary}
            </p>

            {/* Strengths & Improvement */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase text-emerald-400">
                  Top Strengths
                </span>
                {session.topStrengths.map((str, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-white/80">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{str}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase text-amber-400">
                  Growth Target
                </span>
                <div className="flex items-start gap-1.5 text-xs text-white/80">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>{session.improvementArea}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
