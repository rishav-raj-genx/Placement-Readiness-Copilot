'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  AlertCircle,
  Loader2,
  Volume2,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLiveKitInterview } from '@/hooks/use-livekit-interview';
import { useLiveKitInterviewStore } from '@/stores/livekit-interview-store';
import { useInterviewStore } from '@/stores/interview-store';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import type {
  LiveKitQuestionPayload,
  LiveKitTranscriptPayload,
  LiveKitGreetingPayload,
  LiveKitResultsPayload,
  LiveKitErrorPayload,
} from '@/types';
import { normalizeInterviewResult } from '@/lib/interview-result-adapter';

export default function InterviewSessionPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user } = useAuthStore();
  const liveKitStore = useLiveKitInterviewStore();

  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const isLiveKitId = id.startsWith('intv_');

  const handleGreeting = useCallback((_p: LiveKitGreetingPayload) => {}, []);
  const handleQuestion = useCallback((p: LiveKitQuestionPayload) => {
    liveKitStore.updateCurrentQuestion(p);
  }, [liveKitStore]);
  const handleTranscript = useCallback((p: LiveKitTranscriptPayload) => {
    liveKitStore.addTranscript({
      id: p.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      speaker: p.speaker,
      text: p.text,
      final: p.final,
      timestamp: p.timestamp,
    });
  }, [liveKitStore]);

  const handleResults = useCallback((p: LiveKitResultsPayload) => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    liveKitStore.setResults(p);
    liveKitStore.persistResults(liveKitStore.currentInterview?.interviewId || id, p).catch(() => {});
    toast.success('Interview completed! Viewing results...');
    router.push(`/interview/results/${id}`);
  }, [liveKitStore, router, id]);

  const handleError = useCallback((p: LiveKitErrorPayload) => {
    toast.error(p.message);
  }, []);

  const livekit = useLiveKitInterview({
    onGreeting: handleGreeting,
    onQuestion: handleQuestion,
    onTranscript: handleTranscript,
    onResults: handleResults,
    onError: handleError,
  });

  useEffect(() => {
    if (!isLiveKitId) router.replace('/interview/configure');
  }, [isLiveKitId, router]);

  const handleFinishInterview = useCallback(async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    // 1. Send interview:finish event to worker via data channel
    livekit.sendFinishMessage();
    toast.info('Finishing interview... Waiting for AI evaluation results.');

    // 2. Set bounded timeout (15s) to wait for interview:results
    finishTimeoutRef.current = setTimeout(async () => {
      finishTimeoutRef.current = null;
      // If data event did not arrive in 15s, check database directly
      try {
        const { data } = await supabase
          .from('interview_sessions')
          .select('result, status')
          .eq('id', id)
          .maybeSingle();

        if (data?.result) {
          liveKitStore.setResults(normalizeInterviewResult(data.result));
          await livekit.disconnect();
          toast.success('Results loaded from database!');
          router.push(`/interview/results/${id}`);
          return;
        }
      } catch (err) {
        console.error('Database result verification error:', err);
      }

      // If not yet in DB, disconnect safely and route to results page (where polling continues)
      await livekit.disconnect();
      toast.info('Scoring is being finalized. Redirecting to results screen...');
      router.push(`/interview/results/${id}`);
    }, 15000);
  }, [isFinishing, livekit, id, liveKitStore, router]);

  // Connect to LiveKit room using the session data stored by the configure page
  useEffect(() => {
    if (!isLiveKitId || connectionAttempted) return;
    if (!user) return;

    const stored = liveKitStore.currentInterview;
    if (!stored || !stored.serverUrl || !stored.token) {
      setConnectionAttempted(true);
      liveKitStore.setCreateError('Session data not found. Please configure your interview again.');
      return;
    }

    setConnectionAttempted(true);

    (async () => {
      try {
        await livekit.connect({
          serverUrl: stored.serverUrl,
          roomName: stored.roomName,
          token: stored.token,
          interviewId: stored.interviewId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect to interview';
        liveKitStore.setCreateError(message);
        toast.error(message);
      }
    })();
  }, [isLiveKitId, connectionAttempted, user, livekit, liveKitStore]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [livekit.transcripts]);

  // Only persisted LiveKit session IDs are valid.
  if (!isLiveKitId) {
    return null;
  }

  const currentInterview = liveKitStore.currentInterview;
  const status = livekit.status;
  const currentQuestion = livekit.currentQuestion || currentInterview?.currentQuestion;
  const transcripts = livekit.transcripts.length > 0 ? livekit.transcripts : currentInterview?.transcripts || [];

  // Finishing state display
  if (isFinishing) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-brand/30">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
              <Loader2 className="h-8 w-8 text-brand animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Generating Your Interview Results</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                The AI interviewer is analyzing your performance, transcript, and answers to compile your readiness score...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Connection state display
  if (status === 'connecting' || status === 'idle') {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
              <Loader2 className="h-8 w-8 text-brand animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Connecting to your interview</h2>
              <p className="text-sm text-muted-foreground">
                Establishing real-time audio connection with the AI interviewer...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">Connection failed</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                {livekit.error || 'Could not connect to the interview room. Please check your internet connection and try again.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/interview/configure')}>
                Back to Configure
              </Button>
              <Button variant="brand" onClick={() => router.push('/dashboard')}>
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
            <Brain className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Live Mock Interview</h1>
            <p className="text-xs text-muted-foreground">
              {currentInterview?.targetRole || 'Interview'} &middot; Audio Session
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionStatusBadge status={status} />
        </div>
      </div>

      {/* Interviewer Speaking Indicator */}
      <Card className={livekit.isInterviewerSpeaking ? 'border-brand/40 bg-brand/5' : ''}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${livekit.isInterviewerSpeaking ? 'bg-brand/20' : 'bg-muted'}`}>
              <Radio className={`h-5 w-5 transition-colors ${livekit.isInterviewerSpeaking ? 'text-brand' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {livekit.isInterviewerSpeaking ? 'Interviewer is speaking' : 'Listening to your response'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentQuestion
                  ? `Question ${currentQuestion.questionNumber} of ${currentQuestion.totalQuestions}`
                  : 'Waiting for the interviewer...'}
              </p>
            </div>
          </div>
          {currentQuestion && (
            <Badge variant="outline" className="text-xs">
              Q{currentQuestion.questionNumber}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Current Question */}
      {currentQuestion && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="text-xs font-medium text-brand uppercase tracking-wide">
              Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
            </div>
            <h2 className="text-lg font-medium leading-snug">
              {currentQuestion.text}
            </h2>
          </CardContent>
        </Card>
      )}

      {/* Greeting */}
      {livekit.currentGreeting && !currentQuestion && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="text-xs font-medium text-brand uppercase tracking-wide">
              Interviewer Greeting
            </div>
            <h2 className="text-lg font-medium leading-snug">
              {livekit.currentGreeting}
            </h2>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {transcripts.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium">Live Transcript</h3>
            </div>
            <ScrollArea className="h-64 px-4 py-3">
              <div className="space-y-3">
                {transcripts.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex ${entry.speaker === 'student' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        entry.speaker === 'student'
                          ? 'bg-brand/10 text-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-xs font-medium text-muted-foreground block mb-0.5">
                        {entry.speaker === 'student' ? 'You' : 'Interviewer'}
                      </span>
                      {entry.text}
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Audio Controls */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant={livekit.isMicrophoneEnabled ? 'default' : 'outline'}
              size="icon"
              onClick={livekit.toggleMicrophone}
              className="h-12 w-12 rounded-full"
            >
              {livekit.isMicrophoneEnabled ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>
            <div>
              <p className="text-sm font-medium">
                {livekit.isMicrophoneEnabled ? 'Microphone on' : 'Microphone muted'}
              </p>
              <p className="text-xs text-muted-foreground">
                {livekit.isMicrophoneEnabled ? 'Speak naturally to answer' : 'Unmute to speak'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Volume2 className="h-4 w-4" />
            <span>Speaker audio active</span>
          </div>
        </CardContent>
      </Card>

      {/* End Interview */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Session timeout: 30 minutes</span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <PhoneOff className="mr-1.5 h-4 w-4" />
              End Interview
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End this interview?</AlertDialogTitle>
              <AlertDialogDescription>
                The interviewer will generate your final results. You can also let the interview
                complete automatically after all questions are asked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue Interview</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinishInterview}>
                Finish & Get Results
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ConnectionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    connected: { label: 'Connected', color: 'bg-success/10 text-success border-success/20' },
    active: { label: 'Active', color: 'bg-success/10 text-success border-success/20' },
    connecting: { label: 'Connecting', color: 'bg-warning/10 text-warning border-warning/20' },
    disconnected: { label: 'Disconnected', color: 'bg-muted text-muted-foreground' },
    error: { label: 'Error', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    idle: { label: 'Idle', color: 'bg-muted text-muted-foreground' },
    disconnecting: { label: 'Disconnecting', color: 'bg-warning/10 text-warning border-warning/20' },
  };
  const c = config[status] || config.idle;
  return (
    <Badge variant="outline" className={`text-xs ${c.color}`}>
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
      {c.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Demo interview view (original text-based flow for demo accounts)
// ---------------------------------------------------------------------------

function DemoInterviewView({ id }: { id: string }) {
  const router = useRouter();
  const {
    getSession,
    startSession,
    submitAnswer,
    completeSession,
    abandonSession,
    isHydrated,
  } = useInterviewStore();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const session = getSession(id);

  useEffect(() => {
    if (isHydrated && session && session.status === 'configured') {
      startSession(id);
    }
  }, [isHydrated, session, id, startSession]);

  const currentQuestion = session?.questions[currentIdx];
  const answers = session?.answers || [];
  const currentAnswer = answers.find((a) => a.questionId === currentQuestion?.id);

  useEffect(() => {
    if (currentAnswer) {
      setAnswerText(currentAnswer.answerText);
    } else {
      setAnswerText('');
    }
  }, [currentIdx, currentAnswer]);

  useEffect(() => {
    if (session && session.status === 'completed') {
      router.push(`/interview/results/${id}`);
    }
  }, [session, router, id]);

  if (!isHydrated) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Interview session not found.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  if (session.status === 'completed') return null;

  if (!currentQuestion) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">No questions available.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  const handleSubmitAnswer = () => {
    if (!answerText.trim()) {
      toast.error('Please write an answer before submitting');
      return;
    }
    submitAnswer(id, currentQuestion.id, answerText);
    toast.success('Answer submitted');
    if (currentIdx < session.questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      completeSession(id);
      toast.success('Interview completed! Viewing results...');
      router.push(`/interview/results/${id}`);
    }
  };

  const handleFinishNow = () => {
    if (answerText.trim()) submitAnswer(id, currentQuestion.id, answerText);
    completeSession(id);
    toast.success('Interview completed');
    router.push(`/interview/results/${id}`);
  };

  const handleEndInterview = () => {
    abandonSession(id);
    toast.info('Interview abandoned');
    router.push('/dashboard');
  };

  const answeredCount = answers.length;
  const totalQuestions = session.questions.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
            <Brain className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Mock Interview</h1>
            <p className="text-xs text-muted-foreground">
              {session.config.targetRole} &middot; {session.config.type.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Question {currentIdx + 1} of {totalQuestions}</span>
          <span className="text-muted-foreground">{answeredCount} answered</span>
        </div>
        <div className="flex gap-1">
          {session.questions.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < currentIdx ? 'bg-brand' : i === currentIdx ? 'bg-brand/50' : 'bg-border'}`} />
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{currentQuestion.topic}</Badge>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {session.config.durationMinutes} min total
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-brand uppercase tracking-wide">Interview Question</div>
            <h2 className="text-xl font-medium leading-snug">{currentQuestion.questionText}</h2>
            {currentQuestion.expectedConcepts && currentQuestion.expectedConcepts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentQuestion.expectedConcepts.map((concept) => (
                  <Badge key={concept} variant="secondary" className="text-xs">{concept}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your Answer</label>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Type your answer here..."
              rows={8}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-muted-foreground">{answerText.length} characters</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentIdx > 0 && (
                <Button variant="ghost" onClick={() => setCurrentIdx(currentIdx - 1)}>Previous</Button>
              )}
              <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive">End Interview</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End this interview?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You have answered {answeredCount} of {totalQuestions} questions.
                      Unanswered questions will be marked as incomplete.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continue Interview</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndInterview} className="text-destructive">Abandon</AlertDialogAction>
                    <AlertDialogAction onClick={handleFinishNow}>Finish & See Results</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <Button variant="brand" onClick={handleSubmitAnswer}>
              {currentIdx < session.questions.length - 1 ? 'Submit & Next' : 'Submit & Finish'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
