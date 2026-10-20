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
  VolumeX,
  Radio,
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
import { AudioWaveform } from '@/components/interview/audio-waveform';
import { CountdownTimer } from '@/components/interview/countdown-timer';
import { TranscriptDrawer } from '@/components/interview/transcript-drawer';

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
    liveKitStore.setResults(p);
    toast.success('Interview completed! Viewing results...');
    router.push(`/dashboard/interview/results/${id}`);
  }, [finalizeRecording, liveKitStore, router, id]);

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

    // 1. Send interview:finish event to worker via data channel
    livekit.sendFinishMessage();
    void finalizeRecording();
    toast.info('Finishing interview... Waiting for AI evaluation results.');

    // 2. Set bounded timeout (15s) to wait for interview:results
    finishTimeoutRef.current = setTimeout(async () => {
      finishTimeoutRef.current = null;
      await finalizeRecording();
      // If data event did not arrive in 15s, check database directly
      try {
        const { data, error: resultError } = await supabase
          .from('interview_sessions')
          .select('result, status')
          .eq('id', id)
          .maybeSingle();
        if (resultError) throw resultError;

        if (data?.result) {
          liveKitStore.setResults(normalizeInterviewResult(data.result));
          await livekit.disconnect();
          toast.success('Results loaded from database!');
          router.push(`/dashboard/interview/results/${id}`);
          return;
        }
      } catch {
        toast.error('Could not verify the interview result yet. Retrying on the results screen.');
      }

      // If not yet in DB, disconnect safely and route to results page (where polling continues)
      await livekit.disconnect();
      toast.info('Scoring is being finalized. Redirecting to results screen...');
      router.push(`/dashboard/interview/results/${id}`);
    }, 15000);
  }, [finalizeRecording, isFinishing, livekit, id, liveKitStore, router]);

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

      {/* Current Question */}
      {currentQuestion && (
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="p-6 space-y-2.5">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
            </div>
            <h2 className="text-base font-semibold leading-relaxed text-stone-100">
              {currentQuestion.text}
            </h2>
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

      {/* Audio Controls */}
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
