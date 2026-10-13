'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  History,
  Clock,
  Award,
  ArrowRight,
  Brain,
  Filter,
  Radio,
} from 'lucide-react';
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
import { useInterviewStore } from '@/stores/interview-store';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase-client';
import type { InterviewType, SessionStatus } from '@/types';
import { format } from 'date-fns';

interface LiveKitHistoryEntry {
  id: string;
  target_role: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  result: { finalScore?: number; summary?: string } | null;
}

interface CombinedHistoryEntry {
  id: string;
  targetRole: string;
  type: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  difficulty: string;
  durationMinutes: number;
  overallScore?: number;
  topics: string[];
  isLiveKit: boolean;
}

export default function InterviewHistoryPage() {
  const { sessions, isHydrated } = useInterviewStore();
  const { user, isDemoMode } = useAuthStore();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [liveKitSessions, setLiveKitSessions] = useState<LiveKitHistoryEntry[]>([]);
  const [liveKitLoading, setLiveKitLoading] = useState(false);

  useEffect(() => {
    if (!user || isDemoMode) return;
    setLiveKitLoading(true);
    supabase
      .from('interview_sessions')
      .select('id, target_role, status, completed_at, created_at, result')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLiveKitLoading(false);
        if (data) setLiveKitSessions(data as LiveKitHistoryEntry[]);
      });
  }, [user, isDemoMode]);

  // Combine demo sessions and LiveKit sessions
  const demoEntries: CombinedHistoryEntry[] = sessions
    .filter((s) => s.status === 'completed' || s.status === 'abandoned')
    .map((s) => ({
      id: s.id,
      targetRole: s.config.targetRole,
      type: s.config.type,
      status: s.status,
      completedAt: s.completedAt ?? null,
      createdAt: s.createdAt,
      difficulty: s.config.difficulty,
      durationMinutes: s.config.durationMinutes,
      overallScore: s.feedback?.overallScore,
      topics: s.config.topics,
      isLiveKit: false,
    }));

  const liveKitEntries: CombinedHistoryEntry[] = liveKitSessions
    .filter((s) => s.status === 'completed' || s.status === 'abandoned')
    .map((s) => ({
      id: s.id,
      targetRole: s.target_role,
      type: 'live_audio',
      status: s.status,
      completedAt: s.completed_at,
      createdAt: s.created_at,
      difficulty: 'adaptive',
      durationMinutes: 30,
      overallScore: s.result?.finalScore,
      topics: [],
      isLiveKit: true,
    }));

  const allEntries = [...liveKitEntries, ...demoEntries];

  const filteredEntries = allEntries
    .filter((s) => typeFilter === 'all' || s.type === typeFilter)
    .filter((s) => statusFilter === 'all' || s.status === statusFilter)
    .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt));

  if (!isHydrated) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Interview History"
        description="Review your past interview attempts and results."
      />

      {/* Filters */}
      {filteredEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filter:
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
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
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Sessions List */}
      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<History className="h-6 w-6 text-muted-foreground" />}
              title="No interviews yet"
              description="Your completed and abandoned interviews will appear here. Start your first mock interview to get started."
              action={
                <Link href="/interview/configure">
                  <Button variant="brand">
                    <Brain className="mr-1.5 h-4 w-4" />
                    Start Interview
                  </Button>
                </Link>
              }
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
                    {entry.isLiveKit ? (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Radio className="h-3 w-3" />
                        Live Audio
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {entry.type.replace('_', ' ')}
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={
                        entry.status === 'completed'
                          ? 'bg-success/10 text-success'
                          : 'text-muted-foreground'
                      }
                    >
                      {entry.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(entry.completedAt || entry.createdAt), 'MMM d, yyyy')}
                    </span>
                    <span>{entry.difficulty}</span>
                    <span>{entry.durationMinutes} min</span>
                    {entry.overallScore !== undefined && (
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        Score: {entry.overallScore}
                      </span>
                    )}
                  </div>
                  {!entry.isLiveKit && entry.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {entry.topics.slice(0, 3).map((topic) => (
                        <Badge key={topic} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                      {entry.topics.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{entry.topics.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  {entry.status === 'completed' ? (
                    <Link href={`/interview/results/${entry.id}`}>
                      <Button variant="outline" size="sm">
                        Review
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/interview/configure">
                      <Button variant="ghost" size="sm">
                        Retry
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
