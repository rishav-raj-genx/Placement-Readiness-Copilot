'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Room,
  RoomEvent,
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

interface UseLiveKitInterviewOptions {
  onGreeting?: (payload: LiveKitGreetingPayload) => void;
  onQuestion?: (payload: LiveKitQuestionPayload) => void;
  onTranscript?: (payload: LiveKitTranscriptPayload) => void;
  onResults?: (payload: LiveKitResultsPayload) => void;
  onError?: (payload: LiveKitErrorPayload) => void;
}

interface UseLiveKitInterviewReturn {
  status: LiveKitSessionStatus;
  connectionQuality: ConnectionQuality | null;
  isMicrophoneEnabled: boolean;
  isInterviewerSpeaking: boolean;
  transcripts: LiveKitTranscriptEntry[];
  currentGreeting: string | null;
  currentQuestion: LiveKitQuestionPayload | null;
  results: LiveKitResultsPayload | null;
  error: string | null;
  connect: (sessionData: LiveKitSessionResponse) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  sendFinishMessage: () => void;
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
  const [status, setStatus] = useState<LiveKitSessionStatus>('idle');
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<LiveKitTranscriptEntry[]>([]);
  const [currentGreeting, setCurrentGreeting] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<LiveKitQuestionPayload | null>(null);
  const [results, setResults] = useState<LiveKitResultsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const addTranscript = useCallback((entry: LiveKitTranscriptEntry) => {
    setTranscripts((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === entry.id);
      if (existingIndex === -1) return [...prev, entry];

      const updated = [...prev];
      updated[existingIndex] = entry;
      return updated;
    });
  }, []);

  const handleDataReceived = useCallback(
    (payload: Uint8Array) => {
      const parsed = parseEvent(payload);
      if (!parsed) return;

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

  const handleConnectionQualityChanged = useCallback((quality: ConnectionQuality, _participant: Participant) => {
    setConnectionQuality(quality);
  }, []);

  const handleParticipantConnected = useCallback((_participant: RemoteParticipant) => {
    // The interviewer (worker) has joined the room
  }, []);

  const handleActiveSpeakersChanged = useCallback((speakers: Participant[]) => {
    // Interviewer is speaking if any non-local participant is in the active speakers list
    setIsInterviewerSpeaking(speakers.some((s) => !s.isLocal));
  }, []);

  const handleDisconnected = useCallback(() => {
    setStatus('disconnected');
    setIsMicrophoneEnabled(false);
    setIsInterviewerSpeaking(false);
  }, []);

  const connect = useCallback(
    async (sessionData: LiveKitSessionResponse) => {
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      setStatus('connecting');
      setError(null);
      setResults(null);
      setTranscripts([]);
      setCurrentGreeting(null);
      setCurrentQuestion(null);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.DataReceived, handleDataReceived);
      room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
      room.on(RoomEvent.Disconnected, handleDisconnected);

      // Also track existing remote participants (worker may already be in the room)
      room.remoteParticipants.forEach((participant) => {
        handleParticipantConnected(participant);
      });

      try {
        await room.connect(sessionData.serverUrl, sessionData.token);

        // Enable microphone
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicrophoneEnabled(true);

        setStatus('connected');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect to interview room';
        setError(message);
        setStatus('error');
      }
    },
    [handleDataReceived, handleConnectionQualityChanged, handleParticipantConnected, handleActiveSpeakersChanged, handleDisconnected]
  );

  const disconnect = useCallback(async () => {
    if (!roomRef.current) return;
    setStatus('disconnecting');
    await roomRef.current.disconnect();
    roomRef.current = null;
    setStatus('disconnected');
    setIsMicrophoneEnabled(false);
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!roomRef.current) return;
    const newState = !isMicrophoneEnabled;
    await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
    setIsMicrophoneEnabled(newState);
  }, [isMicrophoneEnabled]);

  const sendFinishMessage = useCallback(() => {
    if (!roomRef.current) return;
    const message = JSON.stringify({
      event: 'interview:finish',
      payload: { reason: 'student_requested' },
    });
    const encoder = new TextEncoder();
    roomRef.current.localParticipant.publishData(encoder.encode(message), {
      reliable: true,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  return {
    status,
    connectionQuality,
    isMicrophoneEnabled,
    isInterviewerSpeaking,
    transcripts,
    currentGreeting,
    currentQuestion,
    results,
    error,
    connect,
    disconnect,
    toggleMicrophone,
    sendFinishMessage,
  };
}
