'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain,
  ArrowRight,
  History,
  TrendingUp,
  Target,
  FileText,
  MessagesSquare,
  Clock,
  Award,
  AlertCircle,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { DemoLabel } from '@/components/shared/demo-label';
import { useAuthStore } from '@/stores/auth-store';
import { useInterviewStore } from '@/stores/interview-store';
import { FREE_SESSION_LIMIT } from '@/lib/config';
import { format } from 'date-fns';
import { OnboardingTrigger } from '@/components/onboarding-trigger';
import { supabase } from '@/lib/supabase-client';
import type { LiveKitResultsPayload, LiveKitCategoryScore, ReadinessScore } from '@/types';
import { normalizeInterviewResult } from '@/lib/interview-result-adapter';
import { normalizeReadinessScore } from '@/lib/data-adapters';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { sessions, getCompletedCount, getRemainingCount, canStartNew } = useInterviewStore();

  const [liveKitSession, setLiveKitSession] = useState<{
    id: string;
    targetRole: string;
    completedAt: string | null;
    result: LiveKitResultsPayload;
  } | null>(null);
  const [readinessScore, setReadinessScore] = useState<ReadinessScore | null>(null);

  useEffect(() => {
    if (!user) return;
    // Authoritative source: interview_sessions.result
    supabase
      .from('interview_sessions')
      .select('id, target_role, completed_at, result')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('result', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.result) {
          setLiveKitSession({
            id: data.id,
            targetRole: data.target_role,
            completedAt: data.completed_at,
            result: normalizeInterviewResult(data.result),
          });
        }
      });

    let active = true;
    supabase
      .from('readiness_scores')
      .select('total_score, readiness_level, top_actions, breakdown, updated_at')
      .eq('student_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || error) return;
        setReadinessScore(normalizeReadinessScore(data as unknown));
      });

    return () => {
      active = false;
    };
  }, [user]);

  const completedCount = getCompletedCount();
  const remainingCount = getRemainingCount();
  const progressPercent = (completedCount / FREE_SESSION_LIMIT) * 100;

  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const latestSession = completedSessions[completedSessions.length - 1];
  const recentSessions = [...sessions]
    .filter((s) => s.status === 'completed' || s.status === 'abandoned')
    .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt))
    .slice(0, 5);

  const progressStatus =
    completedCount === 0
      ? 'Start your first interview'
      : completedCount < FREE_SESSION_LIMIT
      ? 'Keep going'
      : 'Free interviews completed';

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Ready for Your Next Interview?"
        description="Choose your target role, select your topics, and start practising."
      />

      {/* Primary AI Interview Panel */}
      <Card className="border-brand/30 bg-card">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
                  <Brain className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">AI Interview Preparation</h2>
                  <p className="text-sm text-muted-foreground">
                    Practise realistic interviews tailored to your target role and skills.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/interview/configure">
                <Button variant="brand" size="lg" disabled={!canStartNew()}>
                  Start Mock Interview
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/interview/history">
                <Button variant="outline" size="lg">
                  <History className="mr-1.5 h-4 w-4" />
                  View History
                </Button>
              </Link>
            </div>
          </div>
          {!canStartNew() && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground/80">
              <AlertCircle className="h-4 w-4 text-warning shrink-0" />
              You have used all {FREE_SESSION_LIMIT} free interview sessions.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Tracker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Free Interview Progress</CardTitle>
              <CardDescription>Your interview practice at a glance</CardDescription>
            </div>
            <DemoLabel />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            {/* Circular Progress Ring */}
            <div className="flex shrink-0 flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="hsl(var(--brand))"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(progressPercent / 100) * 263.89} 263.89`}
                    strokeLinecap="round"
                    className="transition-[stroke-dasharray] duration-500 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-semibold tabular-nums">
                    {completedCount} / {FREE_SESSION_LIMIT}
                  </span>
                  <span className="text-xs text-muted-foreground">Completed</span>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="flex w-full flex-col gap-3 sm:flex-1">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="text-sm font-medium tabular-nums">
                  {completedCount} of {FREE_SESSION_LIMIT}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-sm text-muted-foreground">Remaining</span>
                <span className="text-sm font-medium tabular-nums">{remainingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span
                  className={`text-sm font-medium ${
                    completedCount >= FREE_SESSION_LIMIT ? 'text-success' : 'text-brand'
                  }`}
                >
                  {progressStatus}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {readinessScore && (
        <Card className="border-brand/30">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Placement Readiness Score</CardTitle>
                <CardDescription>Live score produced by the readiness scoring service</CardDescription>
              </div>
              <Badge variant="outline" className="w-fit">
                {readinessScore.readinessLevel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/20 p-5">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="hsl(var(--brand))"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(readinessScore.totalScore / 100) * 263.89} 263.89`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-3xl font-semibold tabular-nums">
                  {readinessScore.totalScore}
                  <span className="text-sm text-muted-foreground">/100</span>
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-semibold">Top 5 Actions</h3>
              </div>
              {readinessScore.topActions.length > 0 ? (
                <ol className="space-y-2">
                  {readinessScore.topActions.map((action, index) => (
                    <li key={`${action.title}-${index}`} className="flex gap-3 rounded-md border border-border p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="text-xs text-muted-foreground">{action.priority}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  The scoring service has not returned action recommendations yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Readiness Section — reads authoritatively from interview_sessions.result */}
      {liveKitSession?.result ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Interview Readiness</CardTitle>
                <CardDescription>
                  Based on your latest Live AI interview for {liveKitSession.targetRole}
                  {liveKitSession.completedAt && ` · ${format(new Date(liveKitSession.completedAt), 'MMM d, yyyy')}`}
                </CardDescription>
              </div>
              {readinessScore && (
                <Badge variant="outline" className="text-xs">
                  {readinessScore.readinessLevel} ({readinessScore.totalScore}/100)
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center">
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <svg className="h-24 w-24 -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="hsl(var(--brand))"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${(liveKitSession.result.finalScore / 100) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-2xl font-semibold">
                    {liveKitSession.result.finalScore}
                  </span>
                </div>
                <span className="mt-1 text-xs text-muted-foreground">Final Score</span>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Readiness Delta:</span>
                  <span className={`text-xs font-semibold ${liveKitSession.result.overallReadinessDelta >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {liveKitSession.result.overallReadinessDelta >= 0 ? '+' : ''}{liveKitSession.result.overallReadinessDelta}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{liveKitSession.result.summary}</p>
              </div>
            </div>

            {/* Category Breakdown */}
            {liveKitSession.result.categoryScores?.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {liveKitSession.result.categoryScores.map((cs: LiveKitCategoryScore, i: number) => (
                  <div key={i} className="rounded-md border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{cs.category}</span>
                      <span className={cs.score >= cs.benchmark ? 'text-success font-semibold' : 'text-warning font-semibold'}>
                        {cs.score} / 100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/interview/results/${liveKitSession.id}`}>
                <Button variant="outline" size="sm">
                  View Full Results
                </Button>
              </Link>
              <Link href="/interview/configure">
                <Button variant="brand" size="sm">
                  Start Another Interview
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : latestSession?.feedback ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interview Readiness</CardTitle>
            <CardDescription>Based on your latest completed interview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Score */}
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center">
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <svg className="h-24 w-24 -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="hsl(var(--brand))"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${(latestSession.feedback.overallScore / 100) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-2xl font-semibold">
                    {latestSession.feedback.overallScore}
                  </span>
                </div>
                <span className="mt-1 text-xs text-muted-foreground">Overall Score</span>
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">{latestSession.feedback.summary}</p>
              </div>
            </div>

            {/* Strengths and Weak Areas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-md border border-border p-4">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Strongest Topics</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {latestSession.feedback.strongestTopics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="bg-success/10 text-success">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-border p-4">
                <div className="flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">Areas to Improve</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {latestSession.feedback.weakAreas.map((topic) => (
                    <Badge key={topic} variant="secondary" className="bg-brand/10 text-brand">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Practice */}
            <div className="space-y-2 rounded-md border border-border p-4">
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recommended Practice Topics</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {latestSession.feedback.recommendedPracticeTopics.map((topic) => (
                  <Badge key={topic} variant="outline">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={`/interview/results/${latestSession.id}`}>
                <Button variant="outline" size="sm">
                  View Full Results
                </Button>
              </Link>
              <Link href="/interview/configure">
                <Button variant="brand" size="sm">
                  Practise Weak Areas
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={<Brain className="h-6 w-6 text-muted-foreground" />}
              title="No interviews yet"
              description="Start your first mock interview to see your readiness score, strengths, and areas to improve."
              action={
                <Link href="/interview/configure">
                  <Button variant="brand">
                    Start Your First Interview
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Recent Interviews */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Interviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={session.status === 'completed' ? `/interview/results/${session.id}` : '/interview/history'}
                className="flex items-center justify-between rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{session.config.targetRole}</span>
                    <Badge variant="outline" className="text-xs">
                      {session.config.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(session.completedAt || session.createdAt), 'MMM d, yyyy')}
                    </span>
                    {session.feedback && (
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        Score: {session.feedback.overallScore}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={session.status === 'completed' ? 'secondary' : 'outline'}
                    className={
                      session.status === 'completed'
                        ? 'bg-success/10 text-success'
                        : 'text-muted-foreground'
                    }
                  >
                    {session.status}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Supporting Tools */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/resources" className="group block h-full">
          <Card className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:border-brand/40 group-hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 transition-colors duration-200 group-hover:border-brand/40 group-hover:bg-brand/10">
                <FileText className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-brand" />
              </div>
              <div>
                <div className="text-sm font-medium transition-colors duration-200 group-hover:text-brand">Resume & Resources</div>
                <div className="text-xs text-muted-foreground">Upload and manage documents</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/resources" className="group block h-full">
          <Card className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:border-brand/40 group-hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 transition-colors duration-200 group-hover:border-brand/40 group-hover:bg-brand/10">
                <MessagesSquare className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-brand" />
              </div>
              <div>
                <div className="text-sm font-medium transition-colors duration-200 group-hover:text-brand">AI Chat Assistant</div>
                <div className="text-xs text-muted-foreground">Ask questions and get prep help</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/jobs" className="group block h-full">
          <Card className="h-full transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-[1.03] group-hover:border-brand/40 group-hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 transition-colors duration-200 group-hover:border-brand/40 group-hover:bg-brand/10">
                <Target className="h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-brand" />
              </div>
              <div>
                <div className="text-sm font-medium transition-colors duration-200 group-hover:text-brand">Browse Jobs</div>
                <div className="text-xs text-muted-foreground">Find and save opportunities</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <OnboardingTrigger />
    </div>
  );
}
