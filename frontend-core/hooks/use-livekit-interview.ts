'use client';

import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteParticipant,
  type Participant,
  type ConnectionQuality,
} from 'livekit-client';

import type {
  LiveKitSessionStatus,
  LiveKitSessionResponse,
  LiveKitGreetingPayload,
  LiveKitQuestionPayload,
  LiveKitTranscriptPayload,
  LiveKitResultsPayload,
  LiveKitErrorPayload,
  LiveKitEventName,
  LiveKitTranscriptEntry,
} from '@/types';
import { resolveLiveKitConnectionUrl } from '@/lib/livekit-session';
import {
  BrowserSpeechSynthesizer,
  BrowserSpeechRecognizer,
  buildInterviewQuestionPlan,
  compileInterviewResults,
  getConversationalGreeting,
  getConversationalTransition,
  getConversationalClosing,
  type VoicePlanItem,
} from '@/lib/voice-speech-engine';
import { markRound1Completed } from '@/lib/round-status';

interface UseLiveKitInterviewOptions {
  targetRole?: string;
  topics?: string[];
  userId?: string;
  onGreeting?: (payload: LiveKitGreetingPayload) => void;
  onQuestion?: (payload: LiveKitQuestionPayload) => void;
  onTranscript?: (payload: LiveKitTranscriptPayload) => void;
  onResults?: (payload: LiveKitResultsPayload) => void;
  onError?: (payload: LiveKitErrorPayload) => void;
}

export interface UseLiveKitInterviewReturn {
  audioContainerRef: RefObject<HTMLDivElement>;
  status: LiveKitSessionStatus;
  connectionQuality: ConnectionQuality | null;
  isMicrophoneEnabled: boolean;
  isSpeakerEnabled: boolean;
  isAudioPlaybackBlocked: boolean;
  isInterviewerSpeaking: boolean;
  localAudioLevel: number;
  remoteAudioLevel: number;
  transcripts: LiveKitTranscriptEntry[];
  currentGreeting: string | null;
  currentQuestion: LiveKitQuestionPayload | null;
  results: LiveKitResultsPayload | null;
  error: string | null;
  currentCandidateAnswer: string;
  hasMoreQuestions: boolean;
  connect: (sessionData: LiveKitSessionResponse) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  enableSpeaker: () => Promise<void>;
  sendFinishMessage: () => void;
  submitCandidateAnswer: (answerText?: string) => Promise<void>;
  repeatCurrentQuestion: () => void;
  setCurrentCandidateAnswer: (text: string) => void;
  compileResultsNow: () => LiveKitResultsPayload;
  startListeningToCandidate: () => void;
  stopListeningToCandidate: () => void;
  isSpeechRecognitionSupported: boolean;
  speechRecognitionError: string | null;
}

function parseEvent(raw: Uint8Array): { event: LiveKitEventName; payload: unknown } | null {
  try {
    const text = new TextDecoder().decode(raw);
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const supportedEvents: LiveKitEventName[] = [
      'interview:greeting',
      'interview:question',
      'interview:transcript',
      'interview:results',
      'interview:error',
    ];
    if (typeof record.event !== 'string' || !supportedEvents.includes(record.event as LiveKitEventName)) {
      return null;
    }
    return { event: record.event as LiveKitEventName, payload: record.payload };
  } catch {
    return null;
  }
}

export function useLiveKitInterview(options: UseLiveKitInterviewOptions = {}): UseLiveKitInterviewReturn {
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const attachedAudioTracksRef = useRef(new Map<string, HTMLMediaElement>());

  // Speech synthesizer and recognizer instances
  const ttsRef = useRef<BrowserSpeechSynthesizer | null>(null);
  const sttRef = useRef<BrowserSpeechRecognizer | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRemoteInterviewerRef = useRef(false);

  // In-browser interview engine state
  const questionPlanRef = useRef<VoicePlanItem[]>([]);
  const currentPlanIndexRef = useRef<number>(0);
  const currentInterviewIdRef = useRef<string>('');
  const hasCheckedMicPermissionRef = useRef(false);

  const [status, setStatus] = useState<LiveKitSessionStatus>('idle');
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isAudioPlaybackBlocked, setIsAudioPlaybackBlocked] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<LiveKitTranscriptEntry[]>([]);
  const [currentGreeting, setCurrentGreeting] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<LiveKitQuestionPayload | null>(null);
  const [results, setResults] = useState<LiveKitResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentCandidateAnswer, setCurrentCandidateAnswerState] = useState<string>('');
  const [speechRecognitionError, setSpeechRecognitionError] = useState<string | null>(null);
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState<boolean>(true);

  const setCurrentCandidateAnswer = useCallback((valOrFn: string | ((prev: string) => string)) => {
    setCurrentCandidateAnswerState((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      sttRef.current?.resetTranscript(next);
      return next;
    });
  }, []);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialize Speech Engines once on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ttsRef.current = new BrowserSpeechSynthesizer();
      sttRef.current = new BrowserSpeechRecognizer();
    }
    return () => {
      ttsRef.current?.stop();
      sttRef.current?.stop();
    };
  }, []);

  const transcriptsRef = useRef<LiveKitTranscriptEntry[]>([]);

  const addTranscript = useCallback((entry: LiveKitTranscriptEntry) => {
    setTranscripts((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === entry.id);
      let updated: LiveKitTranscriptEntry[];
      if (existingIndex === -1) {
        updated = [...prev, entry];
      } else {
        updated = [...prev];
        updated[existingIndex] = entry;
      }
      transcriptsRef.current = updated;
      return updated;
    });
  }, []);

  const startListeningToCandidate = useCallback(async () => {
    if (!sttRef.current) return;
    if (!sttRef.current.isSupported()) {
      setIsSpeechRecognitionSupported(false);
      return;
    }
    setIsSpeechRecognitionSupported(true);

    // Ensure browser microphone permission is actively requested/granted without locking the device
    if (!hasCheckedMicPermissionRef.current && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        hasCheckedMicPermissionRef.current = true;
      } catch (e) {
        console.warn('Microphone permission check notice:', e);
      }
    }

    sttRef.current.start(
      (text: string, isFinal: boolean) => {
        setCurrentCandidateAnswerState(text);
        setSpeechRecognitionError(null);
        const studentEntry: LiveKitTranscriptEntry = {
          id: `student_voice_active`,
          speaker: 'student',
          text,
          final: isFinal,
          timestamp: Date.now(),
        };
        addTranscript(studentEntry);
        optionsRef.current.onTranscript?.(studentEntry);
      },
      (error: string) => {
        setSpeechRecognitionError(error);
      }
    );
  }, [addTranscript]);

  const stopListeningToCandidate = useCallback(() => {
    sttRef.current?.stop();
  }, []);

  // Speak text using in-browser TTS with voice animation
  const speakInterviewerAudio = useCallback(
    (text: string, onDone?: () => void) => {
      if (!ttsRef.current) {
        onDone?.();
        return;
      }

      stopListeningToCandidate();
      setIsInterviewerSpeaking(true);

      ttsRef.current.speak(text, {
        onStart: () => {
          setIsInterviewerSpeaking(true);
        },
        onAudioLevel: (level: number) => {
          setRemoteAudioLevel(level);
        },
        onEnd: () => {
          setIsInterviewerSpeaking(false);
          setRemoteAudioLevel(0);
          startListeningToCandidate();
          onDone?.();
        },
        onError: () => {
          setIsInterviewerSpeaking(false);
          setRemoteAudioLevel(0);
          startListeningToCandidate();
          onDone?.();
        },
      });
    },
    [startListeningToCandidate, stopListeningToCandidate]
  );

  // Present and speak a specific question from plan
  const presentQuestionIndex = useCallback(
    (index: number) => {
      const plan = questionPlanRef.current;
      if (index >= plan.length) return;

      const qItem = plan[index];
      currentPlanIndexRef.current = index;
      setCurrentCandidateAnswer('');
      sttRef.current?.resetTranscript('');

      const questionPayload: LiveKitQuestionPayload = {
        questionId: qItem.id,
        text: qItem.text,
        questionNumber: index + 1,
        totalQuestions: plan.length,
      };

      setCurrentQuestion(questionPayload);
      optionsRef.current.onQuestion?.(questionPayload);

      addTranscript({
        id: `q_${qItem.id}`,
        speaker: 'interviewer',
        text: `Question ${index + 1}: ${qItem.text}`,
        final: true,
        timestamp: Date.now(),
      });

      // Warm, natural conversational voice prompt
      const spokenPrompt = `Question ${index + 1} of ${plan.length}. ${qItem.text}`;
      speakInterviewerAudio(spokenPrompt);
    },
    [addTranscript, speakInterviewerAudio]
  );

  // Activate browser voice interviewer if remote agent is not broadcasting
  const activateBrowserVoiceInterviewer = useCallback(() => {
    if (hasRemoteInterviewerRef.current) return;
    if (currentQuestion !== null) return;

    // Enable microphone by default for oral viva round
    setIsMicrophoneEnabled(true);
    if (!hasCheckedMicPermissionRef.current && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      void navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        hasCheckedMicPermissionRef.current = true;
      }).catch(() => undefined);
    }

    const targetRole = optionsRef.current.targetRole || 'Software Engineer';
    const topics = optionsRef.current.topics || [];
    const plan = buildInterviewQuestionPlan(targetRole, topics);
    questionPlanRef.current = plan;
    currentPlanIndexRef.current = 0;

    const greetingText = getConversationalGreeting(targetRole);
    setCurrentGreeting(greetingText);
    optionsRef.current.onGreeting?.({ message: greetingText });

    addTranscript({
      id: `greeting_${Date.now()}`,
      speaker: 'interviewer',
      text: greetingText,
      final: true,
      timestamp: Date.now(),
    });

    speakInterviewerAudio(greetingText, () => {
      // After speaking the greeting, immediately and smoothly ask Question 1
      presentQuestionIndex(0);
    });
  }, [addTranscript, currentQuestion, presentQuestionIndex, speakInterviewerAudio]);

  const handleDataReceived = useCallback(
    (payload: Uint8Array) => {
      const parsed = parseEvent(payload);
      if (!parsed) return;

      // Remote agent is actively broadcasting, yield browser fallback
      hasRemoteInterviewerRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      switch (parsed.event) {
        case 'interview:greeting': {
          const p = parsed.payload as LiveKitGreetingPayload;
          setCurrentGreeting(p.message);
          optionsRef.current.onGreeting?.(p);
          break;
        }
        case 'interview:question': {
          const p = parsed.payload as LiveKitQuestionPayload;
          setCurrentQuestion(p);
          optionsRef.current.onQuestion?.(p);
          break;
        }
        case 'interview:transcript': {
          const p = parsed.payload as LiveKitTranscriptPayload;
          addTranscript({
            id: p.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            speaker: p.speaker,
            text: p.text,
            final: p.final,
            timestamp: p.timestamp,
          });
          optionsRef.current.onTranscript?.(p);
          break;
        }
        case 'interview:results': {
          const p = parsed.payload as LiveKitResultsPayload;
          setResults(p);
          markRound1Completed(optionsRef.current.userId);
          optionsRef.current.onResults?.(p);
          break;
        }
        case 'interview:error': {
          const p = parsed.payload as LiveKitErrorPayload;
          setError(p.message);
          optionsRef.current.onError?.(p);
          break;
        }
      }
    },
    [addTranscript]
  );

  const attachRemoteAudio = useCallback((track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio || !audioContainerRef.current) return;
    if (track.sid && attachedAudioTracksRef.current.has(track.sid)) return;

    const element = track.attach();
    element.autoplay = true;
    element.setAttribute('playsinline', '');
    audioContainerRef.current.appendChild(element);
    if (track.sid) {
      attachedAudioTracksRef.current.set(track.sid, element);
    }

    void element.play().then(() => {
      setIsAudioPlaybackBlocked(false);
    }).catch(() => {
      setIsAudioPlaybackBlocked(true);
    });
  }, []);

  const detachRemoteAudio = useCallback((track: RemoteTrack) => {
    if (!track.sid) return;
    const element = attachedAudioTracksRef.current.get(track.sid);
    if (element) {
      track.detach(element);
      element.remove();
      attachedAudioTracksRef.current.delete(track.sid);
    }
  }, []);

  const handleConnectionQualityChanged = useCallback((quality: ConnectionQuality) => {
    setConnectionQuality(quality);
  }, []);

  const handleParticipantConnected = useCallback((participant: RemoteParticipant) => {
    // If a non-local participant joins, they may be the remote worker
    if (!participant.isLocal) {
      hasRemoteInterviewerRef.current = true;
    }
  }, []);

  const handleActiveSpeakersChanged = useCallback((speakers: Participant[]) => {
    setIsInterviewerSpeaking(speakers.some((s) => !s.isLocal));
  }, []);

  const handleDisconnected = useCallback(() => {
    setStatus('disconnected');
    setIsMicrophoneEnabled(false);
    setIsInterviewerSpeaking(false);
    ttsRef.current?.stop();
    sttRef.current?.stop();
  }, []);

  const connect = useCallback(
    async (sessionData: LiveKitSessionResponse) => {
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      currentInterviewIdRef.current = sessionData.interviewId;
      setStatus('connecting');
      setError(null);
      setIsAudioPlaybackBlocked(false);
      setResults(null);
      setTranscripts([]);
      setCurrentGreeting(null);
      setCurrentQuestion(null);
      setCurrentCandidateAnswer('');
      hasRemoteInterviewerRef.current = false;

      let room: Room | null = null;
      try {
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;
        const configuredServerUrl = resolveLiveKitConnectionUrl(sessionData.serverUrl, livekitUrl);
        const participantToken = sessionData.token?.trim();

        if (!participantToken) {
          throw new Error('The interview service returned an empty LiveKit token.');
        }
        if (participantToken.split('.').length !== 3) {
          throw new Error('The interview service returned a malformed LiveKit token.');
        }

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.DataReceived, handleDataReceived);
        room.on(RoomEvent.TrackSubscribed, attachRemoteAudio);
        room.on(RoomEvent.TrackUnsubscribed, detachRemoteAudio);
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setIsAudioPlaybackBlocked(!room?.canPlaybackAudio);
        });
        room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
        room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
        room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
        room.on(RoomEvent.Disconnected, handleDisconnected);

        room.remoteParticipants.forEach((participant) => {
          handleParticipantConnected(participant);
        });

        await room.connect(configuredServerUrl, participantToken);

        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((publication) => {
            if (publication.track) attachRemoteAudio(publication.track);
          });
        });

        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicrophoneEnabled(true);
        setStatus('connected');

        // Check if remote participants exist. If none after 2.5s, start In-Browser Voice Interviewer!
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = setTimeout(() => {
          if (!hasRemoteInterviewerRef.current && room?.remoteParticipants.size === 0) {
            activateBrowserVoiceInterviewer();
          }
        }, 2200);

      } catch (err) {
        if (roomRef.current === room) roomRef.current = null;
        if (room) await room.disconnect().catch(() => undefined);
        attachedAudioTracksRef.current.forEach((element) => element.remove());
        attachedAudioTracksRef.current.clear();
        const detail = err instanceof Error ? err.message : 'Unknown connection error';
        const message = `LiveKit connection failed: ${detail}`;
        setError(message);
        setStatus('error');
        throw new Error(message);
      }
    },
    [activateBrowserVoiceInterviewer, attachRemoteAudio, detachRemoteAudio, handleActiveSpeakersChanged, handleConnectionQualityChanged, handleDataReceived, handleDisconnected, handleParticipantConnected]
  );

  const disconnect = useCallback(async () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    ttsRef.current?.stop();
    sttRef.current?.stop();

    if (!roomRef.current) return;
    setStatus('disconnecting');
    await roomRef.current.disconnect();
    roomRef.current = null;
    attachedAudioTracksRef.current.forEach((element) => element.remove());
    attachedAudioTracksRef.current.clear();
    setStatus('disconnected');
    setIsMicrophoneEnabled(false);
  }, []);

  const toggleMicrophone = useCallback(async () => {
    const newState = !isMicrophoneEnabled;
    if (roomRef.current) {
      await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
    } else if (newState && !hasCheckedMicPermissionRef.current && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        hasCheckedMicPermissionRef.current = true;
      } catch (e) {
        console.warn('Microphone permission request error:', e);
      }
    }
    setIsMicrophoneEnabled(newState);
    if (!newState) {
      stopListeningToCandidate();
    } else if (!isInterviewerSpeaking) {
      void startListeningToCandidate();
    }
  }, [isInterviewerSpeaking, isMicrophoneEnabled, startListeningToCandidate, stopListeningToCandidate]);

  const toggleSpeaker = useCallback(async () => {
    const room = roomRef.current;
    const enabled = !isSpeakerEnabled;
    setIsSpeakerEnabled(enabled);

    ttsRef.current?.setMuted(!enabled);

    if (room) {
      if (enabled) {
        try {
          await room.startAudio();
        } catch {
          setIsAudioPlaybackBlocked(true);
        }
      }
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => publication.setEnabled(enabled));
      });
      if (enabled) {
        attachedAudioTracksRef.current.forEach((element) => {
          void element.play().then(() => setIsAudioPlaybackBlocked(false)).catch(() => setIsAudioPlaybackBlocked(true));
        });
      }
    }
  }, [isSpeakerEnabled]);

  const enableSpeaker = useCallback(async () => {
    setIsSpeakerEnabled(true);
    ttsRef.current?.setMuted(false);
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => publication.setEnabled(true));
      });
      await Promise.all(Array.from(attachedAudioTracksRef.current.values()).map((element) => element.play()));
      setIsAudioPlaybackBlocked(false);
    } catch {
      setIsAudioPlaybackBlocked(true);
    }
  }, []);

  const sendFinishMessage = useCallback(() => {
    if (roomRef.current) {
      const message = JSON.stringify({
        event: 'interview:finish',
        payload: { reason: 'student_requested' },
      });
      const encoder = new TextEncoder();
      roomRef.current.localParticipant.publishData(encoder.encode(message), {
        reliable: true,
      });
    }
  }, []);

  // Submit candidate answer and advance to next question or finish interview
  const submitCandidateAnswer = useCallback(
    async (answerText?: string) => {
      stopListeningToCandidate();
      const textToRecord = (answerText ?? currentCandidateAnswer).trim();

      if (textToRecord) {
        const candidateEntry: LiveKitTranscriptEntry = {
          id: `ans_${Date.now()}`,
          speaker: 'student',
          text: textToRecord,
          final: true,
          timestamp: Date.now(),
        };
        addTranscript(candidateEntry);
        optionsRef.current.onTranscript?.({
          id: candidateEntry.id,
          speaker: 'student',
          text: textToRecord,
          final: true,
          timestamp: Date.now(),
        });
      }

      setCurrentCandidateAnswer('');
      sttRef.current?.resetTranscript('');

      const plan = questionPlanRef.current;
      const nextIndex = currentPlanIndexRef.current + 1;

      if (nextIndex < plan.length) {
        // Acknowledge and transition to next question with warm conversational voice
        const transitionPhrase = getConversationalTransition(nextIndex, plan.length);
        speakInterviewerAudio(transitionPhrase, () => {
          presentQuestionIndex(nextIndex);
        });
      } else {
        // Viva completed! Speak final message and compile results immediately
        const closingPhrase = getConversationalClosing();
        speakInterviewerAudio(closingPhrase, () => {
          const targetRole = optionsRef.current.targetRole || 'Software Engineer';
          const compiled = compileInterviewResults(targetRole, transcriptsRef.current);
          setResults(compiled);
          markRound1Completed(optionsRef.current.userId);
          optionsRef.current.onResults?.(compiled);
        });
      }
    },
    [addTranscript, currentCandidateAnswer, presentQuestionIndex, speakInterviewerAudio, stopListeningToCandidate]
  );

  const compileResultsNow = useCallback(() => {
    const targetRole = optionsRef.current.targetRole || 'Software Engineer';
    const compiled = compileInterviewResults(targetRole, transcriptsRef.current);
    setResults(compiled);
    markRound1Completed(optionsRef.current.userId);
    return compiled;
  }, []);

  const repeatCurrentQuestion = useCallback(() => {
    if (!currentQuestion) return;
    const spoken = `Repeating question ${currentQuestion.questionNumber}: ${currentQuestion.text}`;
    speakInterviewerAudio(spoken);
  }, [currentQuestion, speakInterviewerAudio]);

  const hasMoreQuestions =
    questionPlanRef.current.length > 0 &&
    currentPlanIndexRef.current < questionPlanRef.current.length - 1;

  useEffect(() => {
    if (status !== 'connected' && status !== 'active') return;
    const interval = window.setInterval(() => {
      const room = roomRef.current;
      if (!room) return;
      setLocalAudioLevel(room.localParticipant.audioLevel);
      if (!isInterviewerSpeaking) {
        const maxLevel = Math.max(
          0,
          ...Array.from(room.remoteParticipants.values()).map((p) => p.audioLevel)
        );
        setRemoteAudioLevel(maxLevel);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, [isInterviewerSpeaking, status]);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      ttsRef.current?.stop();
      sttRef.current?.stop();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      attachedAudioTracksRef.current.forEach((element) => element.remove());
      attachedAudioTracksRef.current.clear();
    };
  }, []);

  return {
    audioContainerRef,
    status,
    connectionQuality,
    isMicrophoneEnabled,
    isSpeakerEnabled,
    isAudioPlaybackBlocked,
    isInterviewerSpeaking,
    localAudioLevel,
    remoteAudioLevel,
    transcripts,
    currentGreeting,
    currentQuestion,
    results,
    error,
    currentCandidateAnswer,
    hasMoreQuestions,
    connect,
    disconnect,
    toggleMicrophone,
    toggleSpeaker,
    enableSpeaker,
    sendFinishMessage,
    submitCandidateAnswer,
    repeatCurrentQuestion,
    setCurrentCandidateAnswer,
    compileResultsNow,
    startListeningToCandidate,
    stopListeningToCandidate,
    isSpeechRecognitionSupported,
    speechRecognitionError,
  };
}
