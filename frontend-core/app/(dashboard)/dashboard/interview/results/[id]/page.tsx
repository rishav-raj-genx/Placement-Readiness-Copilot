'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  CheckCircle2,
  TrendingUp,
  Target,
  AlertCircle,
  Lightbulb,
  RotateCcw,
  LayoutDashboard,
  Eye,
  Wrench,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DemoLabel } from '@/components/shared/demo-label';
import { useInterviewStore } from '@/stores/interview-store';
import { useLiveKitInterviewStore } from '@/stores/livekit-interview-store';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase-client';
import { compileInterviewResults } from '@/lib/voice-speech-engine';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import type { LiveKitResultsPayload, LiveKitTranscriptEntry } from '@/types';
import { normalizeInterviewResult } from '@/lib/interview-result-adapter';
import { InterviewAuditPlayer } from '@/components/interview/interview-audit-player';

export default function ResultsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { getSession, isHydrated } = useInterviewStore();
  const liveKitStore = useLiveKitInterviewStore();
  const { user } = useAuthStore();
  const [showAnswers, setShowAnswers] = useState(false);
  const [liveKitResults, setLiveKitResults] = useState<LiveKitResultsPayload | null>(null);
  const [liveKitLoading, setLiveKitLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const isLiveKitId = id.startsWith('intv_');
  const session = getSession(id);

  // Load LiveKit results from the store, session/local storage, database, or instant synthesis
  useEffect(() => {
    if (!isLiveKitId) return;

    // 1. Check current livekit store
    const stored = liveKitStore.currentInterview;
    if (stored && stored.results) {
      setLiveKitResults(stored.results);
      return;
    }

    // 2. Check session / local storage directly
    if (typeof window !== 'undefined') {
      const fromSession = sessionStorage.getItem(`interview_result_${id}`);
      if (fromSession) {
        try {
          const parsed = JSON.parse(fromSession) as LiveKitResultsPayload;
          setLiveKitResults(normalizeInterviewResult(parsed));
          return;
        } catch {
          // ignore parse error
        }
      }
      const fromLocal = localStorage.getItem(`interview_result_${id}`);
      if (fromLocal) {
        try {
          const parsed = JSON.parse(fromLocal) as LiveKitResultsPayload;
          setLiveKitResults(normalizeInterviewResult(parsed));
          return;
        } catch {
          // ignore parse error
        }
      }
    }

    // 3. Query the database with short retry
    setLiveKitLoading(true);

    let attempts = 0;
    const maxAttempts = 3;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchResult = async () => {
      try {
        const { data } = await supabase
          .from('interview_sessions')
          .select('result, target_role, completed_at, audio_url, transcript')
          .eq('id', id)
          .maybeSingle();

        if (data) {
          if (data.audio_url) {
            setAudioUrl(data.audio_url);
          }
          if (data.result) {
            const normalized = normalizeInterviewResult(data.result);
            if ((!normalized.transcript || normalized.transcript.length === 0) && Array.isArray(data.transcript)) {
              normalized.transcript = data.transcript as LiveKitTranscriptEntry[];
            }
            setLiveKitResults(normalized);
            setLiveKitLoading(false);
            return true;
          }
        }
      } catch {
        // Safe ignore
      }
      return false;
    };

    fetchResult().then((found) => {
      if (found) return;

      intervalId = setInterval(async () => {
        attempts++;
        const gotIt = await fetchResult();
        if (gotIt || attempts >= maxAttempts) {
          if (intervalId) clearInterval(intervalId);
          if (!gotIt) {
            // Immediate guaranteed fallback synthesis so the user is never stuck
            const role = stored?.targetRole || 'Software Engineer';
            const synthesized = compileInterviewResults(role, stored?.transcripts || []);
            setLiveKitResults(synthesized);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`interview_result_${id}`, JSON.stringify(synthesized));
            }
          }
          setLiveKitLoading(false);
        }
      }, 1000);
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLiveKitId, id, liveKitStore, user]);

  // Demo mode results
  useEffect(() => {
    if (!isLiveKitId && isHydrated && !session) {
      router.push('/dashboard/interviews');
    }
  }, [isLiveKitId, isHydrated, session, router, id]);

  if (isLiveKitId) {
    return (
      <LiveKitResultsView
        id={id}
        results={liveKitResults}
        loading={liveKitLoading}
        audioUrl={audioUrl}
      />
    );
  }

  if (!isHydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="font-mono text-xs text-stone-500">Loading results...</div>
      </div>
    );
  }

  if (!session || !session.feedback) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-stone-500" />
        <p className="text-sm text-stone-400">Results not available.</p>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/interviews')}
          className="border-stone-800 bg-stone-900 text-xs text-stone-200"
        >
          View history
        </Button>
      </div>
    );
  }

  const feedback = session.feedback;

  const radarData = feedback.questionFeedback.map((qf) => {
    const question = session.questions.find((q) => q.id === qf.questionId);
    return { topic: question?.topic || 'N/A', score: qf.score };
  });

  const barData = feedback.questionFeedback.map((qf) => {
    const question = session.questions.find((q) => q.id === qf.questionId);
    return {
      name: `Q${session.questions.findIndex((q) => q.id === qf.questionId) + 1}`,
      Technical: qf.technicalCorrectness,
      Clarity: qf.answerClarity,
      Communication: qf.communicationQuality,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#D93829]" />
            <h1 className="text-2xl font-bold text-stone-100">Interview complete</h1>
          </div>
          <p className="text-xs text-stone-400">
            {session.config.targetRole} &middot; {session.config.type.replace('_', ' ')} &middot;{' '}
            {session.completedAt && format(new Date(session.completedAt), 'MMM d, yyyy')}
          </p>
        </div>
        <DemoLabel />
      </div>

      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="#1c1917" strokeWidth="8" fill="none" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#D93829"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(feedback.overallScore / 100) * 351.7} 351.7`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-3xl font-bold text-stone-100">{feedback.overallScore}</span>
              </div>
              <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-stone-500">Overall score</span>
            </div>
            <div className="flex-1 md:ml-8">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
                Interview evaluation &amp; feedback
              </div>
              <p className="text-xs leading-relaxed text-stone-300">{feedback.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-stone-200">Topic performance</CardTitle>
            <CardDescription className="text-xs text-stone-400">Score by interview topic</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#292524" />
                <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#78716c' }} />
                <Radar dataKey="score" stroke="#D93829" fill="#D93829" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-stone-200">Evaluation breakdown</CardTitle>
            <CardDescription className="text-xs text-stone-400">Per-question scores by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#78716c' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #292524', borderRadius: '8px', fontSize: '11px', color: '#e7e5e4' }} />
                <Bar dataKey="Technical" fill="#D93829" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Clarity" fill="#78716c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Communication" fill="#a8a29e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <CardTitle className="text-sm font-semibold text-stone-200">Strengths</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {feedback.strongestTopics.map((topic) => (
                <Badge key={topic} variant="secondary" className="border border-emerald-900/40 bg-emerald-950/30 text-xs text-emerald-300">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#D93829]" />
              <CardTitle className="text-sm font-semibold text-stone-200">Areas to improve</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {feedback.weakAreas.map((topic) => (
                <Badge key={topic} variant="secondary" className="border border-stone-700 bg-stone-800 text-xs text-stone-300">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-stone-400" />
            <CardTitle className="text-sm font-semibold text-stone-200">Recommended practice topics</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {feedback.recommendedPracticeTopics.map((topic) => (
              <Badge key={topic} variant="outline" className="border-stone-800 bg-stone-900 text-xs text-stone-400">
                {topic}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-stone-200">Question-by-question feedback</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAnswers(!showAnswers)} className="text-xs text-stone-400 hover:text-stone-200">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              {showAnswers ? 'Hide answers' : 'Review answers'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback.questionFeedback.map((qf, i) => {
            const question = session.questions.find((q) => q.id === qf.questionId);
            const answer = session.answers.find((a) => a.questionId === qf.questionId);
            return (
              <div key={qf.questionId} className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-stone-400">Q{i + 1}</span>
                      {question && (
                        <Badge variant="outline" className="border-stone-800 bg-stone-900 text-[10px] text-stone-400">
                          {question.topic}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-medium text-stone-200">{question?.questionText}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`font-mono text-base font-bold ${qf.score >= 70 ? 'text-emerald-400' : qf.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {qf.score}
                    </span>
                    <span className="font-mono text-[10px] text-stone-500">score</span>
                  </div>
                </div>
                {showAnswers && (
                  <div className="space-y-1 rounded-lg border border-stone-800 bg-stone-950 p-3">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">Your answer</div>
                    <p className="text-xs text-stone-300">{answer?.answerText || 'No answer submitted'}</p>
                  </div>
                )}
                <div className="grid gap-2 text-xs text-stone-400 sm:grid-cols-3">
                  <div>Technical: <span className="font-mono font-medium text-stone-200">{qf.technicalCorrectness}</span></div>
                  <div>Clarity: <span className="font-mono font-medium text-stone-200">{qf.answerClarity}</span></div>
                  <div>Communication: <span className="font-mono font-medium text-stone-200">{qf.communicationQuality}</span></div>
                </div>
                {qf.strengths.length > 0 && <div className="text-xs"><span className="text-emerald-400 font-medium">Strengths: </span><span className="text-stone-400">{qf.strengths.join(', ')}</span></div>}
                {qf.weaknesses.length > 0 && <div className="text-xs"><span className="text-amber-400 font-medium">Weaknesses: </span><span className="text-stone-400">{qf.weaknesses.join(', ')}</span></div>}
                {qf.missingConcepts.length > 0 && <div className="text-xs"><span className="text-red-400 font-medium">Missing: </span><span className="text-stone-400">{qf.missingConcepts.join(', ')}</span></div>}
                {qf.suggestedImprovements.length > 0 && <div className="text-xs"><span className="text-stone-400 font-medium">Suggested: </span><span className="text-stone-400">{qf.suggestedImprovements.join(', ')}</span></div>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Link href="/dashboard">
          <Button variant="ghost" className="text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200">
            <LayoutDashboard className="mr-1.5 h-4 w-4" />
            Return to dashboard
          </Button>
        </Link>
        <div className="flex gap-2">
          <Link href="/dashboard/interviews">
            <Button variant="outline" className="rounded-lg border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              View history
            </Button>
          </Link>
          <Link href="/dashboard/interview">
            <Button className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Try another interview
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveKit results view — displays worker-generated results
// ---------------------------------------------------------------------------

function LiveKitResultsView({
  id,
  results,
  loading,
  audioUrl,
}: {
  id: string;
  results: LiveKitResultsPayload | null;
  loading: boolean;
  audioUrl?: string | null;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="font-mono text-xs text-stone-500">Loading results...</div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-stone-500" />
        <p className="text-sm font-semibold text-stone-200">Results not yet available</p>
        <p className="text-xs text-stone-400 max-w-md text-center">
          The interview worker is still processing your session. Please check back shortly,
          or your results will appear here once scoring is complete.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/interviews')}
            className="rounded-lg border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800"
          >
            View history
          </Button>
          <Button
            onClick={() => router.push('/dashboard/interview')}
            className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white hover:bg-[#C22F21]"
          >
            New interview
          </Button>
        </div>
      </div>
    );
  }

  const radarData = results.categoryScores.map((cs) => ({
    topic: cs.category,
    score: cs.score,
    benchmark: cs.benchmark,
  }));

  const barData = results.categoryScores.map((cs, i) => ({
    name: `C${i + 1}`,
    Score: cs.score,
    Benchmark: cs.benchmark,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#D93829]" />
            <h1 className="text-2xl font-bold text-stone-100">Interview complete</h1>
          </div>
          <p className="font-mono text-xs text-stone-400">
            Live AI interview &middot; Interview ID: {id}
          </p>
        </div>
      </div>

      {/* Round 2 Coding Challenge Unlocked Banner */}
      <Card className="rounded-2xl border-2 border-[#D93829]/60 bg-gradient-to-r from-[#28201E] via-[#331c19] to-[#28201E] shadow-xl shadow-red-950/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#D93829] text-white font-mono text-[10px] px-2.5 py-0.5">
                  ROUND 1 COMPLETED
                </Badge>
                <span className="font-mono text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Round 2 IDE Unlocked
                </span>
              </div>
              <h2 className="text-xl font-bold text-stone-100">
                Proceed to Round 2: Live Coding Challenge &amp; IDE Evaluation
              </h2>
              <p className="text-xs text-stone-300 max-w-xl leading-relaxed">
                Test your practical implementation skills in the interactive Monaco IDE. Write code, execute live test cases, and receive real-time AI code review with algorithmic complexity benchmarks.
              </p>
            </div>
            <Link href="/dashboard/interview/coding">
              <Button className="bg-[#D93829] hover:bg-[#C22F21] text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 shrink-0">
                <Code2 className="h-4 w-4" /> Start Round 2 Coding IDE <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Overall Score */}
      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-center">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="h-32 w-32 -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="#1c1917" strokeWidth="8" fill="none" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#D93829"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(results.finalScore / 100) * 351.7} 351.7`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-3xl font-bold text-stone-100">{results.finalScore}</span>
              </div>
              <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-stone-500">Final score</span>
            </div>
            <div className="flex-1 md:ml-8 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <Award className="h-4 w-4 text-[#D93829]" />
                <span className="font-medium text-stone-300">Readiness delta: </span>
                <span className={`font-mono font-bold ${results.overallReadinessDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {results.overallReadinessDelta >= 0 ? '+' : ''}{results.overallReadinessDelta}
                </span>
              </div>
              {(results.isProvisional || results.isFallback) && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-950/30 border border-amber-900/40 px-3 py-2 text-xs text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    <strong>Provisional assessment:</strong> This score was generated using fallback mode ({results.evaluationMode || 'heuristic_fallback'}).
                  </span>
                </div>
              )}
              <p className="text-xs leading-relaxed text-stone-300">{results.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-stone-200">Category performance</CardTitle>
            <CardDescription className="text-xs text-stone-400">Score vs benchmark by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#292524" />
                <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#78716c' }} />
                <Radar dataKey="score" stroke="#D93829" fill="#D93829" fillOpacity={0.25} />
                <Radar dataKey="benchmark" stroke="#52525b" fill="none" strokeDasharray="4 4" />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-stone-200">Score vs benchmark</CardTitle>
            <CardDescription className="text-xs text-stone-400">Category scores compared to the benchmark</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#78716c' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #292524', borderRadius: '8px', fontSize: '11px', color: '#e7e5e4' }} />
                <Bar dataKey="Score" fill="#D93829" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Benchmark" fill="#52525b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Scores Detail */}
      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-stone-200">Category breakdown</CardTitle>
          <CardDescription className="text-xs text-stone-400">Detailed scores, strengths, and critiques per category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.categoryScores.map((cs, i) => (
            <div key={i} className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">Category {i + 1}</span>
                  <p className="text-xs font-semibold text-stone-200">{cs.category}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className={`font-mono text-base font-bold ${cs.score >= cs.benchmark ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {cs.score}
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">benchmark: {cs.benchmark}</span>
                </div>
              </div>
              {cs.strengths.length > 0 && (
                <div className="text-xs"><span className="text-emerald-400 font-medium">Strengths: </span><span className="text-stone-400">{cs.strengths.join(', ')}</span></div>
              )}
              {cs.critiques.length > 0 && (
                <div className="text-xs"><span className="text-amber-400 font-medium">Critiques: </span><span className="text-stone-400">{cs.critiques.join(', ')}</span></div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Suggested Fixes */}
      {results.suggestedFixes.length > 0 && (
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#D93829]" />
              <CardTitle className="text-sm font-semibold text-stone-200">Suggested improvements</CardTitle>
            </div>
            <CardDescription className="text-xs text-stone-400">Specific changes to improve your readiness</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.suggestedFixes.map((fix, i) => (
              <div key={i} className="rounded-xl border border-stone-800 bg-stone-900/60 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-200">{fix.title}</p>
                  <Badge variant="outline" className="border-stone-800 bg-stone-900 font-mono text-[10px] text-stone-400">
                    {fix.location}
                  </Badge>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">{fix.recommendedChange}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Replayable Timestamped Transcript & Audio Player for Auditing */}
      <InterviewAuditPlayer
        audioUrl={audioUrl}
        transcript={results.transcript || []}
      />

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Link href="/dashboard">
          <Button variant="ghost" className="text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200">
            <LayoutDashboard className="mr-1.5 h-4 w-4" />
            Return to dashboard
          </Button>
        </Link>
        <div className="flex gap-2">
          <Link href="/dashboard/interviews">
            <Button variant="outline" className="rounded-lg border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              View history
            </Button>
          </Link>
          <Link href="/dashboard/interview/coding">
            <Button className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]">
              <Code2 className="mr-1.5 h-4 w-4" />
              Proceed to Round 2 IDE
            </Button>
          </Link>
          <Link href="/dashboard/interview">
            <Button variant="outline" className="rounded-lg border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              New Viva
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
