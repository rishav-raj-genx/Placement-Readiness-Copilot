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
import { normalizeInterviewResult } from '@/lib/interview-result-adapter';

interface LiveKitHistoryEntry {
  id: string;
  target_role: string;
  status: string;
  completed_at: string | null;
  started_at: string | null;
  created_at: string;
  config: unknown;
  result: unknown;
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

function elapsedMinutes(session: LiveKitHistoryEntry): number | null {
  if (!session.started_at || !session.completed_at) return null;
  const elapsed = new Date(session.completed_at).getTime() - new Date(session.started_at).getTime();
  return elapsed > 0 ? Math.max(1, Math.round(elapsed / 60_000)) : null;
}

function toHistoryEntry(session: LiveKitHistoryEntry): HistoryEntry {
  const config = isRecord(session.config) ? session.config : {};
  const result = isRecord(session.result) ? normalizeInterviewResult(session.result) : null;
  const hasScore = isRecord(session.result)
    && (typeof session.result.interview_score === 'number' || typeof session.result.finalScore === 'number');

  return {
    id: session.id,
    targetRole: session.target_role,
    type: readString(config.type) ?? 'live_audio',
    status: session.status,
    completedAt: session.completed_at,
    createdAt: session.created_at,
    difficulty: readString(config.difficulty),
    durationMinutes: readPositiveNumber(config.durationMinutes) ?? elapsedMinutes(session),
    overallScore: result && hasScore ? result.finalScore : undefined,
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
    if (!user?.id) return;
    let active = true;

    const loadHistory = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from('interview_sessions')
          .select('id, target_role, status, completed_at, started_at, created_at, config, result')
          .eq('user_id', user.id)
          .in('status', ['completed', 'abandoned'])
          .order('created_at', { ascending: false })
          .limit(50);
        if (queryError) throw queryError;
        if (active) setSessions((data ?? []) as LiveKitHistoryEntry[]);
      } catch (loadError: unknown) {
        if (active) {
          setSessions([]);
          setError(loadError instanceof Error ? loadError.message : 'Interview history could not be loaded.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadHistory();
    return () => { active = false; };
  }, [user?.id]);

  const entries = sessions.map(toHistoryEntry);
  const filteredEntries = entries
    .filter((session) => typeFilter === 'all' || session.type === typeFilter)
    .filter((session) => statusFilter === 'all' || session.status === statusFilter);

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading interview history...</div></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Interview History" description="Review your completed mock interviews and recorded results." />

      {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Filter className="h-4 w-4" />Filter:</div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="live_audio">Live Audio</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="coding">Coding</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="behavioral">Behavioral</SelectItem>
              <SelectItem value="system_design">System Design</SelectItem>
              <SelectItem value="role_specific">Role-Specific</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<History className="h-6 w-6 text-muted-foreground" />}
              title={entries.length ? 'No interviews match these filters' : 'No mock interviews yet'}
              description={entries.length ? 'Change the filters to view another interview.' : 'Completed and abandoned mock interviews will appear here.'}
              action={entries.length ? undefined : (
                <Link href="/interview/configure"><Button variant="brand"><Brain className="mr-1.5 h-4 w-4" />Start Interview</Button></Link>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.targetRole}</span>
                    <Badge variant="outline" className="gap-1 text-xs"><Radio className="h-3 w-3" />{entry.type.replaceAll('_', ' ')}</Badge>
                    <Badge variant="secondary" className={entry.status === 'completed' ? 'bg-success/10 text-success' : 'text-muted-foreground'}>{entry.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(entry.completedAt || entry.createdAt), 'MMM d, yyyy')}</span>
                    {entry.difficulty && <span>{entry.difficulty}</span>}
                    {entry.durationMinutes !== null && <span>{entry.durationMinutes} min</span>}
                    {entry.overallScore !== undefined && <span className="flex items-center gap-1"><Award className="h-3 w-3" />Score: {entry.overallScore}</span>}
                  </div>
                  {entry.topics.length > 0 && <div className="flex flex-wrap gap-1 pt-1">{entry.topics.slice(0, 3).map((topic) => <Badge key={topic} variant="secondary" className="text-xs">{topic}</Badge>)}</div>}
                </div>
                {entry.status === 'completed' ? (
                  <Link href={`/interview/results/${entry.id}`}><Button variant="outline" size="sm">Review<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></Link>
                ) : (
                  <Link href="/interview/configure"><Button variant="ghost" size="sm">Retry</Button></Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
