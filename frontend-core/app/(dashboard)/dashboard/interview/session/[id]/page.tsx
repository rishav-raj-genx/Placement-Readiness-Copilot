'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Brain,
  Mic,
  MicOff,
  PhoneOff,
  Clock,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  Radio,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useInterviewRecorder } from '@/hooks/useInterviewRecorder';
import { useLiveKitInterviewStore } from '@/stores/livekit-interview-store';
import { useInterviewStore } from '@/stores/interview-store';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { markRound1Completed } from '@/lib/round-status';
import type {
  LiveKitQuestionPayload,
  LiveKitTranscriptPayload,
  LiveKitGreetingPayload,
  LiveKitResultsPayload,
  LiveKitErrorPayload,
} from '@/types';
import { normalizeInterviewResult } from '@/lib/interview-result-adapter';
import { AudioWaveform } from '@/components/interview/audio-waveform';
import { CountdownTimer } from '@/components/interview/countdown-timer';
import { TranscriptDrawer } from '@/components/interview/transcript-drawer';
import { TextInterviewChat } from '@/components/interview/text-interview-chat';

export default function InterviewSessionPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user } = useAuthStore();
  const liveKitStore = useLiveKitInterviewStore();

  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const finishTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleRecordingError = useCallback((message: string) => {
    toast.error(`Interview audio was not saved: ${message}`);
  }, []);

  const {
    status: recordingStatus,
    chunks: recordingChunks,
    startRecording,
    stopAndUpload,
    setCaptureEnabled,
  } = useInterviewRecorder({
    interviewId: id,
    userId: user?.id,
    onError: handleRecordingError,
  });

  const finalizeRecording = useCallback(async () => {
    try {
      await stopAndUpload();
    } catch {
      // The recorder reports a user-facing error and must not block result navigation.
    }
  }, [stopAndUpload]);

  const handleResults = useCallback(async (p: LiveKitResultsPayload) => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    await finalizeRecording();
    markRound1Completed(user?.id);

    // Deep state saving to backend database
    const transcriptTurns = p.transcript && p.transcript.length > 0
      ? p.transcript
      : liveKitStore.currentInterview?.transcripts || [];

    try {
      await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: id,
          transcript: transcriptTurns,
          vivaScores: p,
          result: p,
          status: 'completed',
        }),
      });
    } catch (saveErr) {
      console.warn('Backend interview completion persist warning:', saveErr);
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`interview_result_${id}`, JSON.stringify(p));
      localStorage.setItem(`interview_result_${id}`, JSON.stringify(p));
      localStorage.setItem('interview_round1_completed', 'true');
    }
    liveKitStore.setResults(p);
    if (user?.id) {
      void useProfileStore.getState().analyze(user.id);
    }
    toast.success('Interview completed! Viewing results...');
    router.push(`/dashboard/interview/results/${id}`);
  }, [finalizeRecording, id, liveKitStore, router, user?.id]);

  const [sessionMeta, setSessionMeta] = useState<{
    targetRole?: string;
    topics?: string[];
    mode?: string;
    durationMinutes?: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'adaptive';
    experienceLevel?: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('interview_sessions')
          .select('target_role, config')
          .eq('id', id)
          .maybeSingle();

        if (data) {
          const cfg = (data.config && typeof data.config === 'object') ? data.config as Record<string, unknown> : {};
          const topics = Array.isArray(cfg.topics) ? (cfg.topics as string[]) : [];
          setSessionMeta({
            targetRole: data.target_role || undefined,
            topics,
            mode: typeof cfg.mode === 'string' ? cfg.mode : undefined,
            durationMinutes: typeof cfg.durationMinutes === 'number' ? cfg.durationMinutes : undefined,
            difficulty: cfg.difficulty === 'easy' || cfg.difficulty === 'medium' || cfg.difficulty === 'hard' || cfg.difficulty === 'adaptive'
              ? cfg.difficulty
              : undefined,
            experienceLevel: typeof cfg.experienceLevel === 'string' ? cfg.experienceLevel : undefined,
          });
        }
      } catch {
        // safe fallback
      }
    })();
  }, [id]);

  const searchParams = useSearchParams();
  const queryMode = searchParams.get('mode');
  const isTextMode =
    queryMode === 'text' ||
    liveKitStore.currentInterview?.mode === 'text' ||
    sessionMeta?.mode === 'text';

  const effectiveTargetRole =
    liveKitStore.currentInterview?.targetRole ||
    sessionMeta?.targetRole ||
    user?.targetRole ||
    'Software Engineer';

  const effectiveTopics =
    liveKitStore.currentInterview?.topics ||
    sessionMeta?.topics ||
    [];

  const handleError = useCallback((p: LiveKitErrorPayload) => {
    toast.error(p.message);
  }, []);

  const livekit = useLiveKitInterview({
    targetRole: effectiveTargetRole,
    topics: effectiveTopics,
    userId: user?.id,
    onGreeting: handleGreeting,
    onQuestion: handleQuestion,
    onTranscript: handleTranscript,
    onResults: handleResults,
    onError: handleError,
  });

  const [isTranscribingChunk, setIsTranscribingChunk] = useState(false);

  const handleTranscribeRecordedAudio = useCallback(async () => {
    if (!recordingChunks || recordingChunks.length === 0) {
      toast.info('No audio chunks captured yet. Please speak into your microphone first.');
      return;
    }
    setIsTranscribingChunk(true);
    toast.info('Processing audio with AI Whisper...');
    try {
      const audioBlob = new Blob([...recordingChunks], { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'candidate_response.webm');

      const res = await fetch('/api/interview/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as { success?: boolean; text?: string; error?: string };
      if (data.success && data.text) {
        livekit.setCurrentCandidateAnswer((prev: string) => (prev ? `${prev} ${data.text}` : data.text || ''));
        toast.success('Audio transcribed successfully with AI Whisper!');
      } else {
        toast.info(data.error || 'Speech transcription complete.');
      }
    } catch {
      toast.error('Failed to communicate with transcription service.');
    } finally {
      setIsTranscribingChunk(false);
    }
  }, [livekit, recordingChunks]);

  useEffect(() => {
    if (livekit.status === 'connected' || livekit.status === 'active') {
      void startRecording().catch(() => undefined);
      return;
    }
    if (livekit.status === 'disconnected' || livekit.status === 'error') {
      void stopAndUpload().catch(() => undefined);
    }
  }, [livekit.status, startRecording, stopAndUpload]);

  useEffect(() => {
    setCaptureEnabled(livekit.isMicrophoneEnabled);
  }, [livekit.isMicrophoneEnabled, setCaptureEnabled]);

  useEffect(() => {
    if (!isLiveKitId) router.replace('/dashboard/interview');
  }, [isLiveKitId, router]);

  const handleFinishInterview = useCallback(async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    livekit.sendFinishMessage();
    void finalizeRecording();
    toast.info('Finishing interview and compiling results...');

    finishTimeoutRef.current = setTimeout(() => {
      setIsFinishing(false);
      toast.error('The interview is still being finalized. Your transcript is saved; retry shortly.');
    }, 20_000);
  }, [finalizeRecording, isFinishing, livekit]);

  // Connect to LiveKit room using the session data stored by the configure page
  useEffect(() => {
    if (!isLiveKitId || connectionAttempted || isTextMode) return;
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

  const currentInterview = liveKitStore.currentInterview;
  const status = livekit.status;
  const currentQuestion = livekit.currentQuestion || currentInterview?.currentQuestion;
  const transcripts = livekit.transcripts.length > 0 ? livekit.transcripts : currentInterview?.transcripts || [];

  const startListening = livekit.startListeningToCandidate;
  const isInterviewerSpeaking = livekit.isInterviewerSpeaking;
  const isMicrophoneEnabled = livekit.isMicrophoneEnabled;
  const hasCurrentQuestion = Boolean(currentQuestion);

  useEffect(() => {
    if (
      isLiveKitId &&
      !isInterviewerSpeaking &&
      hasCurrentQuestion &&
      isMicrophoneEnabled
    ) {
      void startListening();
    }
  }, [
    isLiveKitId,
    isInterviewerSpeaking,
    hasCurrentQuestion,
    isMicrophoneEnabled,
    startListening,
  ]);

  // Only persisted LiveKit session IDs are valid.
  if (!isLiveKitId) {
    return null;
  }

  if (isTextMode) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <TextInterviewChat
          interviewId={id}
          targetRole={effectiveTargetRole}
          durationMinutes={liveKitStore.currentInterview?.durationMinutes || sessionMeta?.durationMinutes || 15}
          topics={effectiveTopics}
          difficulty={sessionMeta?.difficulty}
          experienceLevel={sessionMeta?.experienceLevel}
          userId={user?.id}
          onFinish={async (resultsPayload) => {
            try {
              await fetch('/api/interview/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  interviewId: id,
                  transcript: resultsPayload.transcript || [],
                  vivaScores: resultsPayload,
                  result: resultsPayload,
                  status: 'completed',
                }),
              });
            } catch (saveErr) {
              console.warn('Backend text interview completion persist warning:', saveErr);
            }

            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`interview_result_${id}`, JSON.stringify(resultsPayload));
              localStorage.setItem(`interview_result_${id}`, JSON.stringify(resultsPayload));
              localStorage.setItem('interview_round1_completed', 'true');
            }
            markRound1Completed(user?.id);
            liveKitStore.setResults(resultsPayload);

            if (user?.id) {
              void useProfileStore.getState().analyze(user.id);
            }

            toast.success('Interview completed! Viewing results...');
            router.push(`/dashboard/interview/results/${id}`);
          }}
          onAbandon={() => {
            router.push('/dashboard/interview');
          }}
        />
      </div>
    );
  }

  // Finishing state display
  if (isFinishing) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-stone-800 bg-stone-900">
              <Loader2 className="h-7 w-7 text-[#D93829] animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold text-stone-100">Generating your interview results</h2>
              <p className="text-xs text-stone-400 max-w-md">
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
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-stone-800 bg-stone-900">
              <Loader2 className="h-7 w-7 text-[#D93829] animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold text-stone-100">Connecting to your interview</h2>
              <p className="text-xs text-stone-400">
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
        <Card className="rounded-2xl border border-red-900/40 bg-red-950/20 shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-red-900/40 bg-red-950/40">
              <AlertCircle className="h-7 w-7 text-red-400" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold text-stone-100">Connection failed</h2>
              <p className="text-xs text-stone-400 max-w-md">
                {livekit.error || 'Could not connect to the interview room. Please check your internet connection and try again.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/interview')}
                className="border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800"
              >
                Back to configure
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-[#D93829] text-xs font-semibold text-white hover:bg-[#C22F21]"
              >
                Return to dashboard
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-800 bg-stone-900 text-[#D93829]">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-100">Live mock interview</h1>
            <p className="text-xs text-stone-400">
              {currentInterview?.targetRole || 'Interview'} &middot; Audio session
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentInterview?.startedAt && (
            <CountdownTimer
              startedAt={currentInterview.startedAt}
              durationMinutes={currentInterview.durationMinutes || 15}
              onExpire={() => void handleFinishInterview()}
            />
          )}
          {(recordingStatus === 'recording' || recordingStatus === 'uploading') && (
            <Badge variant="outline" className="border-red-900/40 bg-red-950/30 text-xs text-red-300">
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full bg-red-400 ${recordingStatus === 'recording' ? 'animate-pulse' : ''}`} />
              {recordingStatus === 'recording' ? 'Recording' : 'Saving audio'}
            </Badge>
          )}
          <ConnectionStatusBadge status={status} />
        </div>
      </div>

      {/* Interviewer Speaking Indicator */}
      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border border-stone-800 transition-colors ${
                livekit.isInterviewerSpeaking ? 'bg-[#D93829]/20 text-[#D93829]' : 'bg-stone-900 text-stone-500'
              }`}
            >
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-100">
                {livekit.isInterviewerSpeaking ? 'Interviewer is speaking' : 'Listening to your response'}
              </p>
              <p className="text-xs text-stone-400">
                {currentQuestion
                  ? `Question ${currentQuestion.questionNumber} of ${currentQuestion.totalQuestions}`
                  : 'Waiting for the interviewer...'}
              </p>
            </div>
          </div>
          {currentQuestion && (
            <Badge variant="outline" className="border-stone-700 bg-stone-800 font-mono text-[11px] text-stone-300">
              Q{currentQuestion.questionNumber}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Current Question & Candidate Response Card */}
      {currentQuestion && (
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={livekit.repeatCurrentQuestion}
                className="text-xs text-stone-300 border-stone-700 bg-stone-900/60 hover:bg-stone-800"
              >
                <Volume2 className="mr-1.5 h-3.5 w-3.5" /> Replay Question Voice
              </Button>
            </div>

            <h2 className="text-base font-semibold leading-relaxed text-stone-100">
              {currentQuestion.text}
            </h2>

            {/* Candidate Response Section - Live Voice & Verbal Viva Canvas */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-stone-300">
                    <Mic className="h-3.5 w-3.5 text-[#D93829]" /> Verbal Response (Speech-To-Text Transcribed Live)
                  </span>
                  {livekit.currentCandidateAnswer && (
                    <button
                      type="button"
                      onClick={() => {
                        livekit.setCurrentCandidateAnswer('');
                        toast.info('Response cleared. You can speak or edit your answer again.');
                      }}
                      className="text-[11px] text-stone-400 hover:text-stone-200 underline ml-1"
                    >
                      Clear Answer
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {livekit.isInterviewerSpeaking ? (
                    <span className="flex items-center gap-1.5 text-xs text-amber-300">
                      <Volume2 className="h-3.5 w-3.5 animate-pulse" /> AI Interviewer speaking...
                    </span>
                  ) : livekit.isMicrophoneEnabled ? (
                    <div className="flex items-center gap-2 rounded-lg border border-orange-900/60 bg-orange-950/40 px-3 py-1 text-xs text-orange-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                      </span>
                      <span>Listening &middot; Speak aloud</span>
                    </div>
                  ) : (
                    <span className="text-xs text-stone-400">Microphone muted</span>
                  )}
                  <Button
                    type="button"
                    variant={livekit.isMicrophoneEnabled ? 'outline' : 'default'}
                    size="sm"
                    onClick={async () => {
                      if (!livekit.isMicrophoneEnabled) {
                        await livekit.toggleMicrophone();
                      }
                      livekit.startListeningToCandidate();
                      toast.info('Microphone active! Speak naturally — your voice is transcribing live.');
                    }}
                    className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                      livekit.isMicrophoneEnabled
                        ? 'border-orange-800 bg-orange-950/40 text-orange-400 hover:bg-orange-900/50'
                        : 'bg-[#D93829] hover:bg-[#C22F21] text-white'
                    }`}
                  >
                    <Mic className="mr-1 h-3.5 w-3.5" />
                    {livekit.isMicrophoneEnabled ? 'Voice Input Active' : 'Enable Microphone'}
                  </Button>
                </div>
              </div>

              {/* Status and Diagnostics Notice (Non-blocking) */}
              {(livekit.speechRecognitionError || !livekit.isSpeechRecognitionSupported) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-900/40 bg-amber-950/30 p-2.5 text-xs text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      {!livekit.isSpeechRecognitionSupported
                        ? 'Browser Web Speech API not supported. Audio recording remains 100% active for faculty review — type or answer below.'
                        : `Microphone is actively recording for faculty review. Browser cloud speech STT reported: ${livekit.speechRecognitionError}. You can speak or edit your answer directly below.`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      livekit.startListeningToCandidate();
                      toast.info('Re-starting speech recognition...');
                    }}
                    className="h-6 text-[10px] text-amber-200 border-amber-800 bg-amber-900/40 hover:bg-amber-800/50"
                  >
                    Retry Voice STT
                  </Button>
                </div>
              )}

              {/* Real-time Voice & Text Viva Response Area */}
              <div className="relative rounded-xl border border-stone-800 bg-stone-950/80 p-3.5 transition-colors focus-within:border-[#D93829]/70">
                <div className="flex items-center justify-between border-b border-stone-800/60 pb-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-stone-800 bg-stone-900/80 font-mono text-[10px] text-stone-300">
                      Oral Viva &middot; Live Voice Canvas
                    </Badge>
                    {livekit.isMicrophoneEnabled && !livekit.isInterviewerSpeaking && (
                      <span className="flex items-center gap-1.5 text-[10px] text-orange-400 font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                        Live Voice-to-Text Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isTranscribingChunk || !recordingChunks || recordingChunks.length === 0}
                      onClick={handleTranscribeRecordedAudio}
                      className="h-6 text-[10px] text-stone-300 hover:text-white border border-stone-800 bg-stone-900/60 hover:bg-stone-800 px-2"
                      title="Transcribe recorded candidate audio with AI Whisper"
                    >
                      {isTranscribingChunk ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin text-amber-400" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3 text-amber-400" />
                      )}
                      Sync Voice (Whisper AI)
                    </Button>
                    <span className="text-[10px] text-stone-400 font-mono">
                      {livekit.currentCandidateAnswer
                        ? `${livekit.currentCandidateAnswer.split(/\s+/).filter(Boolean).length} words`
                        : 'Speak or type to answer'}
                    </span>
                  </div>
                </div>

                <textarea
                  value={livekit.currentCandidateAnswer}
                  onChange={(e) => livekit.setCurrentCandidateAnswer(e.target.value)}
                  placeholder="Speak your response into the microphone... Your voice will transcribe here in real time. You can also edit or type directly at any time."
                  rows={4}
                  className="flex w-full bg-transparent p-1 text-sm font-medium text-stone-100 placeholder:text-stone-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-stone-500">
                  Full conversation and audio stream recorded for faculty &amp; admin audit
                </span>
                <Button
                  onClick={() => void livekit.submitCandidateAnswer(livekit.currentCandidateAnswer)}
                  disabled={!livekit.currentCandidateAnswer.trim()}
                  className="bg-[#D93829] hover:bg-[#C22F21] text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-lg disabled:opacity-50"
                >
                  {livekit.hasMoreQuestions ? (
                    <>
                      Submit Verbal Answer <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Submit &amp; Complete Viva <Sparkles className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Greeting */}
      {livekit.currentGreeting && !currentQuestion && (
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="p-6 space-y-2.5">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Interviewer greeting
            </div>
            <h2 className="text-base font-semibold leading-relaxed text-stone-100">
              {livekit.currentGreeting}
            </h2>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <TranscriptDrawer transcripts={transcripts} />
      </div>

      <div ref={livekit.audioContainerRef} className="sr-only" aria-hidden="true" />
      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={livekit.toggleMicrophone}
              className={`h-11 w-11 rounded-full transition-colors ${
                livekit.isMicrophoneEnabled
                  ? 'border-[#D93829] bg-[#D93829] text-white hover:bg-[#C22F21]'
                  : 'border-stone-800 bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
              }`}
            >
              {livekit.isMicrophoneEnabled ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>
            <AudioWaveform level={livekit.localAudioLevel} label="Microphone input level" />
            <div>
              <p className="text-xs font-semibold text-stone-200">
                {livekit.isMicrophoneEnabled ? 'Microphone on' : 'Microphone muted'}
              </p>
              <p className="text-[11px] text-stone-400">
                {livekit.isMicrophoneEnabled ? 'Speak naturally to answer' : 'Unmute to speak'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AudioWaveform level={livekit.remoteAudioLevel} label="Interviewer audio level" />
            <Button
              variant="ghost"
              size="sm"
              onClick={livekit.toggleSpeaker}
              aria-label={livekit.isSpeakerEnabled ? 'Mute interviewer audio' : 'Enable interviewer audio'}
              className="text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200"
            >
              {livekit.isSpeakerEnabled ? <Volume2 className="mr-1.5 h-3.5 w-3.5" /> : <VolumeX className="mr-1.5 h-3.5 w-3.5" />}
              {livekit.isSpeakerEnabled ? 'Speaker on' : 'Speaker off'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {livekit.isAudioPlaybackBlocked && (
        <div role="status" className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <span>Allow audio playback to hear the interviewer.</span>
          <Button onClick={() => void livekit.enableSpeaker()}>
            <Volume2 className="mr-2 h-4 w-4" />
            Enable interviewer audio
          </Button>
        </div>
      )}

      {/* End Interview */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <Clock className="h-3.5 w-3.5 text-stone-500" />
          <span>Automatic finish at the configured duration</span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-stone-400 hover:bg-stone-800 hover:text-red-300">
              <PhoneOff className="mr-1.5 h-3.5 w-3.5" />
              End interview
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-xl border border-stone-800 bg-[#28201E] text-stone-200 shadow-lg shadow-black/50">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-stone-100">End this interview?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-stone-400">
                The interviewer will generate your final results. You can also let the interview
                complete automatically after all questions are asked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800">
                Continue interview
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleFinishInterview} className="bg-[#D93829] text-xs font-semibold text-white hover:bg-[#C22F21]">
                Finish and view results
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
    connected: { label: 'Connected', color: 'border-stone-700 bg-stone-800 text-stone-200' },
    active: { label: 'Active', color: 'border-stone-700 bg-stone-800 text-stone-200' },
    connecting: { label: 'Connecting', color: 'border-amber-900/40 bg-amber-950/30 text-amber-300' },
    disconnected: { label: 'Disconnected', color: 'border-stone-800 bg-stone-900 text-stone-500' },
    error: { label: 'Error', color: 'border-red-900/40 bg-red-950/30 text-red-300' },
    idle: { label: 'Idle', color: 'border-stone-800 bg-stone-900 text-stone-500' },
    disconnecting: { label: 'Disconnecting', color: 'border-amber-900/40 bg-amber-950/30 text-amber-300' },
  };
  const c = config[status] || config.idle;
  return (
    <Badge variant="outline" className={`font-mono text-[10px] ${c.color}`}>
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
      {c.label}
    </Badge>
  );
}
