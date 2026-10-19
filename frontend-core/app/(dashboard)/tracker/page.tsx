'use client';

import React, { useState } from 'react';
import {
  KanbanSquare,
  Plus,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

type ColumnId = 'saved' | 'applied' | 'interview' | 'offer';

interface TrackerCard {
  id: string;
  company: string;
  role: string;
  salary: string;
  appliedDate: string;
  stage: ColumnId;
  notes?: string;
}

const INITIAL_CARDS: TrackerCard[] = [
  {
    id: 'app-1',
    company: 'Stripe',
    role: 'Software Engineer',
    salary: '₹32 LPA',
    appliedDate: 'Oct 17, 2026',
    stage: 'interview',
    notes: 'Technical viva round scheduled with Hiring Manager.',
  },
  {
    id: 'app-2',
    company: 'Google',
    role: 'Associate Software Engineer (L3)',
    salary: '₹36 LPA',
    appliedDate: 'Oct 14, 2026',
    stage: 'applied',
    notes: 'Resume screened via MSOT fast-track referral.',
  },
  {
    id: 'app-3',
    company: 'Razorpay',
    role: 'Frontend Engineer II',
    salary: '₹26 LPA',
    appliedDate: 'Oct 19, 2026',
    stage: 'saved',
    notes: 'Target role matching 91% of profile skills.',
  },
  {
    id: 'app-4',
    company: 'Uber',
    role: 'Backend SDE',
    salary: '₹34 LPA',
    appliedDate: 'Oct 08, 2026',
    stage: 'offer',
    notes: 'Written offer letter received. Reviewing compensation.',
  },
];

const COLUMNS: { id: ColumnId; title: string; color: string }[] = [
  { id: 'saved', title: 'Saved', color: '#6366F1' },
  { id: 'applied', title: 'Applied', color: '#06B6D4' },
  { id: 'interview', title: 'Interview', color: '#8B5CF6' },
  { id: 'offer', title: 'Offer', color: '#10B981' },
];

export default function TrackerPage() {
  const [cards, setCards] = useState<TrackerCard[]>(INITIAL_CARDS);

  const moveCard = (id: string, nextStage: ColumnId) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, stage: nextStage } : c)),
    );
    toast.success(`Application updated to ${nextStage.toUpperCase()}`);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
            <KanbanSquare className="h-3.5 w-3.5" />
            <span>PIPELINE TELEMETRY</span>
          </div>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Application Tracker
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Manage and track your placement pipeline from 1-click matches to final offers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => toast.info('Add manual application modal or sync from matched jobs')}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/[0.08]"
        >
          <Plus className="h-4 w-4" />
          <span>Add Application</span>
        </button>
      </div>

      {/* Kanban Board Columns Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.stage === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-3xl border border-white/10 bg-[#0E1524]/70 p-4 shadow-xl backdrop-blur-2xl"
            >
              {/* Column Header */}
              <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="font-[var(--font-display)] text-sm font-bold text-white">
                    {col.title}
                  </span>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[11px] font-bold text-white/50">
                  {colCards.length}
                </span>
              </div>

              {/* Cards in Column */}
              <div className="flex-1 space-y-3">
                {colCards.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-xs text-white/30">
                    No active applications
                  </div>
                ) : (
                  colCards.map((card) => (
                    <div
                      key={card.id}
                      className="group rounded-2xl border border-white/10 bg-[#121B2E]/90 p-4 shadow-md backdrop-blur-xl transition-all duration-200 hover:border-white/25 hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-xs font-bold text-cyan-300">
                            {card.company}
                          </p>
                          <h4 className="mt-0.5 text-sm font-bold text-white leading-snug">
                            {card.role}
                          </h4>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-white/50">
                        <span>{card.salary}</span>
                        <span>{card.appliedDate}</span>
                      </div>

                      {card.notes && (
                        <p className="mt-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-[11px] leading-relaxed text-white/60">
                          {card.notes}
                        </p>
                      )}

                      {/* Move to next stage quick action */}
                      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
                        <span className="text-[10px] font-mono text-white/30 uppercase">
                          Stage: {col.title}
                        </span>

                        {col.id !== 'offer' && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextCol: Record<ColumnId, ColumnId> = {
                                saved: 'applied',
                                applied: 'interview',
                                interview: 'offer',
                                offer: 'offer',
                              };
                              moveCard(card.id, nextCol[col.id]);
                            }}
                            className="flex items-center gap-1 font-mono text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
                          >
                            <span>Advance</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
