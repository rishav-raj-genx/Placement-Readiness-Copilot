'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Award, Brain, Clock, Filter, History, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase-client';

interface LiveKitHistoryEntry {
  id: string;
  target_role?: string;
  status: string;
  completed_at: string | null;
  started_at: string | null;
  created_at: string;
  config?: unknown;
  result?: unknown;
  viva_scores?: unknown;
  code_history?: string | null;
  admin_score?: number | null;
  interview_score?: number | null;
  viva_score?: number | null;
  ide_score?: number | null;
}

interface HistoryEntry {
  id: string;
  targetRole: string;
  type: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  difficulty: string | null;
  durationMinutes: number | null;
  overallScore?: number;
  vivaScore?: number;
  ideScore?: number;
  topics: string[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function readNumericScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(Math.min(100, Math.max(0, value)));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.round(Math.min(100, Math.max(0, parsed)));
    }
  }
  return null;
}

function resolveRoundScores(session: LiveKitHistoryEntry): {
  vivaScore?: number;
  ideScore?: number;
  overallScore?: number;
} {
  const config = isRecord(session.config) ? session.config : {};
  const vivaScores = isRecord(session.viva_scores) ? session.viva_scores : {};
  const result = isRecord(session.result) ? session.result : {};
  const codingResult = isRecord(result.coding_result) ? result.coding_result : {};

  // Check explicit viva_score / ide_score fields first
  let viva =
    readNumericScore(session.viva_score) ??
    readNumericScore(vivaScores.viva_score) ??
    readNumericScore(result.viva_score) ??
    readNumericScore(vivaScores.round1_score);

  let ide =
    readNumericScore(session.ide_score) ??
    readNumericScore(vivaScores.ide_score) ??
    readNumericScore(result.ide_score) ??
    readNumericScore(codingResult.overall_score) ??
    readNumericScore(vivaScores.round2_score);

  const isCoding =
    config.type === 'coding' ||
    config.round === 2 ||
    Boolean(session.code_history);

  const genericScore =
    readNumericScore(session.interview_score) ??
    readNumericScore(session.admin_score) ??
    readNumericScore(result.interview_score) ??
    readNumericScore(result.finalScore) ??
    readNumericScore(vivaScores.interview_score) ??
    readNumericScore(vivaScores.overall_score);

  if (viva === null && !isCoding && genericScore !== null) {
    viva = genericScore;
  }
  if (ide === null && isCoding && genericScore !== null) {
    ide = genericScore;
  }

  let overall: number | undefined;
  if (viva !== null && ide !== null) {
    overall = Math.round((viva + ide) / 2);
  } else if (genericScore !== null) {
    overall = genericScore;
  } else if (viva !== null) {
    overall = viva;
  } else if (ide !== null) {
    overall = ide;
  }

  return {
    vivaScore: viva !== null ? viva : undefined,
    ideScore: ide !== null ? ide : undefined,
    overallScore: overall,
  };
}

function elapsedMinutes(session: LiveKitHistoryEntry): number | null {
  if (!session.started_at || !session.completed_at) return null;
  const elapsed = new Date(session.completed_at).getTime() - new Date(session.started_at).getTime();
  return elapsed > 0 ? Math.max(1, Math.round(elapsed / 60_000)) : null;
}

function toHistoryEntry(session: LiveKitHistoryEntry): HistoryEntry {
  const config = isRecord(session.config) ? session.config : {};
  const { vivaScore, ideScore, overallScore } = resolveRoundScores(session);

  return {
    id: session.id,
    targetRole: session.target_role || 'Software Engineer',
    type: readString(config.type) ?? 'live_audio',
    status: session.status,
    completedAt: session.completed_at,
    createdAt: session.created_at,
    difficulty: readString(config.difficulty),
    durationMinutes: readPositiveNumber(config.durationMinutes) ?? elapsedMinutes(session),
    overallScore,
    vivaScore,
    ideScore,
    topics: readStringArray(config.topics),
  };
}

export default function InterviewHistoryPage() {
  const user = useAuthStore((state) => state.user);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sessions, setSessions] = useState<LiveKitHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadHistory = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      const combinedSessions: LiveKitHistoryEntry[] = [];
      const seenIds = new Set<string>();

      try {
        // Strict Privacy Lockdown: students can only view their own interviews
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const activeUserId = authUser?.id || user?.id;

        if (activeUserId) {
          const { data: history, error: queryError } = await supabase
            .from('interview_sessions')
            .select('*')
            .eq('student_id', activeUserId) // CRITICAL PRIVACY LOCK
            .order('created_at', { ascending: false });

          if (queryError) {
            console.warn('Supabase history fetch notice:', queryError.message);
          } else if (Array.isArray(history)) {
            history.forEach((row) => {
              if (row && row.id && !seenIds.has(row.id)) {
                seenIds.add(row.id);
                combinedSessions.push(row as LiveKitHistoryEntry);
              }
            });
          }
        }
      } catch (loadError: unknown) {
        console.warn('Supabase history fetch notice:', loadError);
      }

      if (active) {
        setSessions(combinedSessions);
        setIsLoading(false);
      }
    };

    void loadHistory();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const entries = sessions.map(toHistoryEntry);
  const filteredEntries = entries
    .filter((session) => typeFilter === 'all' || session.type === typeFilter)
    .filter((session) => statusFilter === 'all' || session.status === statusFilter);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="font-mono text-xs text-stone-500">Loading interview history...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Interview history" description="Review your completed mock interviews and recorded results." />

      {error && (
        <p role="alert" className="rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-xs text-red-300">
          {error}
        </p>
      )}

      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <Filter className="h-3.5 w-3.5 text-stone-500" />
            Filter:
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-40 border-stone-800 bg-stone-900 text-xs text-stone-200 focus:ring-[#D93829]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="border-stone-800 bg-[#28201E] text-stone-200">
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="live_audio">Live audio</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="coding">Coding</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="behavioral">Behavioral</SelectItem>
              <SelectItem value="system_design">System design</SelectItem>
              <SelectItem value="role_specific">Role-specific</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 border-stone-800 bg-stone-900 text-xs text-stone-200 focus:ring-[#D93829]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="border-stone-800 bg-[#28201E] text-stone-200">
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="py-12">
            <EmptyState
              icon={<History className="h-6 w-6 text-stone-400" />}
              title={entries.length ? 'No interviews match these filters' : 'No mock interviews yet'}
              description={
                entries.length
                  ? 'Try adjusting or resetting your round type and status filters to view previous recordings.'
                  : 'Practice realistic technical viva and live coding interviews with autonomous AI feedback and speech analysis.'
              }
              action={
                entries.length ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTypeFilter('all');
                      setStatusFilter('all');
                    }}
                    className="rounded-lg border-stone-700 bg-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-700"
                  >
                    Reset filters
                  </Button>
                ) : (
                  <Link href="/dashboard/interview">
                    <Button className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B]">
                      <Brain className="mr-1.5 h-3.5 w-3.5" />
                      Start Technical Viva
                    </Button>
                  </Link>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="rounded-xl border border-stone-800 bg-[#28201E] shadow-none transition-colors hover:border-stone-700">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-100">{entry.targetRole}</span>
                    <Badge variant="outline" className="gap-1 border-stone-700 bg-stone-800 font-mono text-[11px] text-stone-300">
                      <Radio className="h-3 w-3 text-stone-400" />
                      {entry.type.replaceAll('_', ' ')}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={
                        entry.status === 'completed'
                          ? 'border border-stone-700 bg-stone-800 text-stone-200'
                          : 'border border-stone-800 bg-stone-900 text-stone-500'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Clock className="h-3 w-3 text-stone-500" />
                      {format(new Date(entry.completedAt || entry.createdAt), 'MMM d, yyyy')}
                    </span>
                    {entry.difficulty && <span className="capitalize">{entry.difficulty}</span>}
                    {entry.durationMinutes !== null && <span>{entry.durationMinutes} min</span>}
                  </div>

                  {entry.status === 'completed' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                      <span className="inline-flex items-center gap-1 rounded border border-emerald-800/60 bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-300">
                        <Radio className="h-3 w-3 text-emerald-400" />
                        Round 1 Viva: {entry.vivaScore !== undefined ? `${entry.vivaScore}/100` : '--/100'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded border border-blue-800/60 bg-blue-950/40 px-2 py-0.5 text-[11px] text-blue-300">
                        <Brain className="h-3 w-3 text-blue-400" />
                        Round 2 IDE: {entry.ideScore !== undefined ? `${entry.ideScore}/100` : '--/100'}
                      </span>
                      {entry.overallScore !== undefined && (
                        <span className="inline-flex items-center gap-1 rounded border border-[#D93829]/40 bg-[#D93829]/10 px-2 py-0.5 text-[11px] font-semibold text-[#FF8577]">
                          <Award className="h-3 w-3 text-[#D93829]" />
                          Score: {entry.overallScore}/100
                        </span>
                      )}
                    </div>
                  )}

                  {entry.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {entry.topics.slice(0, 3).map((topic) => (
                        <Badge key={topic} variant="secondary" className="border border-stone-800 bg-stone-900 text-[10px] text-stone-400">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {entry.status === 'completed' ? (
                  <Link href={`/dashboard/interview/results/${entry.id}`}>
                    <Button variant="outline" size="sm" className="rounded-lg border-stone-700 bg-stone-800 text-xs font-medium text-stone-200 transition-colors hover:border-[#D93829] hover:bg-stone-700 hover:text-white">
                      View Feedback
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/dashboard/interview">
                    <Button variant="ghost" size="sm" className="rounded-lg text-xs text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200">
                      Retry
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
