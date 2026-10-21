'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Loader2,
  Clock,
  MessageSquare,
  Bot,
  User,
  AlertCircle,
  Sparkles,
  PhoneOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CountdownTimer } from '@/components/interview/countdown-timer';
import { supabase } from '@/lib/supabase-client';
import { normalizeInterviewResult } from '@/lib/interview-result-adapter';
import { compileInterviewResults } from '@/lib/voice-speech-engine';
import type { LiveKitResultsPayload, LiveKitTranscriptEntry } from '@/types';
import { toast } from 'sonner';

interface TextInterviewChatProps {
  interviewId: string;
  targetRole: string;
  durationMinutes: number;
  topics?: string[];
  userId?: string;
  onFinish: (result: LiveKitResultsPayload, transcripts: LiveKitTranscriptEntry[]) => Promise<void>;
  onAbandon?: () => void;
}

export function TextInterviewChat({
  interviewId,
  targetRole,
  durationMinutes,
  topics,
  userId,
  onFinish,
  onAbandon,
}: TextInterviewChatProps) {
  const [messages, setMessages] = useState<LiveKitTranscriptEntry[]>([]);
  const [inputAnswer, setInputAnswer] = useState('');
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'finishing' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readyToFinish, setReadyToFinish] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [startedAt] = useState(() => new Date().toISOString());

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<LiveKitTranscriptEntry[]>([]);
  messagesRef.current = messages;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Connect to backend WebSocket /ws/interview
  useEffect(() => {
    let isCancelled = false;
    const wsUrl = process.env.NEXT_PUBLIC_MOCK_INTERVIEW_WS_URL || 'ws://127.0.0.1:8002/ws/interview';

    async function initSocket() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token || 'test-token';

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isCancelled) {
            ws.close();
            return;
          }
          setStatus('connected');
          // Send start event
          ws.send(
            JSON.stringify({
              event: 'start',
              auth_token: authToken,
              student_id: userId,
              session_config: {
                target_duration_minutes: durationMinutes,
                role_category: targetRole,
              },
              resume: {
                name: 'Candidate',
                target_role: targetRole,
                text: topics?.length ? `Key topics: ${topics.join(', ')}` : targetRole,
              },
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data || typeof data !== 'object') return;

            if (data.event === 'greeting') {
              const text = String(data.text || '');
              const entry: LiveKitTranscriptEntry = {
                id: `greeting_${Date.now()}`,
                speaker: 'interviewer',
                text,
                timestamp: Date.now(),
                final: true,
              };
              setMessages((prev) => [...prev, entry]);
            } else if (data.event === 'question') {
              const text = String(data.text || '');
              const entry: LiveKitTranscriptEntry = {
                id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                speaker: 'interviewer',
                text,
                timestamp: Date.now(),
                final: true,
              };
              setMessages((prev) => [...prev, entry]);
              setQuestionCount((c) => c + 1);
              setIsWaitingResponse(false);
            } else if (data.event === 'ready_to_finish' || data.event === 'question_limit_reached') {
              setReadyToFinish(true);
              setIsWaitingResponse(false);
              toast.info('All interview questions completed. You can now submit for scoring.');
            } else if (data.event === 'result') {
              const rawResult = data.result || data;
              const normalized = normalizeInterviewResult(rawResult);
              normalized.transcript = messagesRef.current;
              void onFinish(normalized, messagesRef.current);
            } else if (data.event === 'error') {
              const msg = String(data.message || 'Interview socket error');
              setErrorMessage(msg);
              toast.error(msg);
              setIsWaitingResponse(false);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          if (isCancelled) return;
          setStatus('error');
          setErrorMessage('Unable to connect to mock interview service. Ensure service is running on port 8002.');
        };

        ws.onclose = () => {
          if (!isCancelled && status !== 'finishing') {
            setStatus('error');
          }
        };
      } catch (err) {
        if (!isCancelled) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'WebSocket initialization failed');
        }
      }
    }

    void initSocket();

    return () => {
      isCancelled = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [durationMinutes, onFinish, targetRole, topics, userId]);

  const handleSendAnswer = () => {
    const text = inputAnswer.trim();
    if (!text || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const entry: LiveKitTranscriptEntry = {
      id: `ans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      speaker: 'student',
      text,
      timestamp: Date.now(),
      final: true,
    };
    setMessages((prev) => [...prev, entry]);
    setInputAnswer('');
    setIsWaitingResponse(true);

    socketRef.current.send(
      JSON.stringify({
        event: 'answer',
        text,
      })
    );
  };

  const handleFinish = async () => {
    setStatus('finishing');
    toast.info('Finishing text interview and evaluating rubric...');

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event: 'finish' }));

      // Fallback timeout in case server does not return result event promptly
      setTimeout(() => {
        const synthesized = compileInterviewResults(targetRole, messagesRef.current);
        synthesized.transcript = messagesRef.current;
        void onFinish(synthesized, messagesRef.current);
      }, 3000);
    } else {
      const synthesized = compileInterviewResults(targetRole, messagesRef.current);
      synthesized.transcript = messagesRef.current;
      void onFinish(synthesized, messagesRef.current);
    }
  };

  return (
    <div className="space-y-4">
      {/* Session Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-800 bg-[#28201E] px-5 py-3">
        <div className="flex items-center gap-3">
          <Badge className="bg-[#D93829] text-white font-mono text-[10px] px-2.5 py-0.5">
            TEXT MODE
          </Badge>
          <span className="text-xs font-semibold text-stone-200">
            {targetRole} Viva
          </span>
          <span className="text-xs text-stone-500 font-mono">
            Question #{questionCount || 1}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <CountdownTimer durationMinutes={durationMinutes} startedAt={startedAt} onExpire={() => void handleFinish()} />
          <Button
            variant="ghost"
            size="sm"
            onClick={onAbandon}
            className="text-stone-400 hover:text-stone-200 hover:bg-stone-800 text-xs gap-1.5"
          >
            <PhoneOff className="h-3.5 w-3.5 text-red-400" /> End Viva
          </Button>
        </div>
      </div>

      {/* Main Chat Stream */}
      <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="space-y-3 min-h-[350px] max-h-[500px] overflow-y-auto pr-2">
            {status === 'connecting' && (
              <div className="flex flex-col items-center justify-center p-12 text-stone-400 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-[#D93829]" />
                <span className="text-xs font-mono">Connecting to Interview WebSocket engine...</span>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{errorMessage || 'Connection failed.'}</span>
              </div>
            )}

            {messages.map((m) => {
              const isInterviewer = m.speaker === 'interviewer';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 rounded-xl border p-4 ${
                    isInterviewer
                      ? 'border-stone-800/90 bg-stone-900/70'
                      : 'border-stone-800/60 bg-[#1c1615]/80'
                  }`}
                >
                  <div className="shrink-0 pt-0.5">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-lg border text-xs ${
                        isInterviewer
                          ? 'border-red-900/40 bg-red-950/40 text-red-400'
                          : 'border-emerald-900/40 bg-emerald-950/40 text-emerald-400'
                      }`}
                    >
                      {isInterviewer ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </span>
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="font-semibold text-xs text-stone-300">
                      {isInterviewer ? 'AI Interviewer' : 'You'}
                    </div>
                    <p className="text-xs leading-relaxed text-stone-100 whitespace-pre-wrap">
                      {m.text}
                    </p>
                  </div>
                </div>
              );
            })}

            {isWaitingResponse && (
              <div className="flex items-center gap-2 text-stone-400 text-xs italic p-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D93829]" />
                <span>Interviewer is evaluating your response and preparing the next question...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Typing Area */}
          <div className="border-t border-stone-800/80 pt-4 space-y-3">
            <Textarea
              rows={3}
              value={inputAnswer}
              onChange={(e) => setInputAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAnswer();
                }
              }}
              disabled={isWaitingResponse || status !== 'connected'}
              placeholder="Type your structured answer here (press Enter to submit)..."
              className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 text-xs"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                Shift + Enter for new line &middot; Answers are recorded and audited for rubric grading
              </span>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSendAnswer}
                  disabled={!inputAnswer.trim() || isWaitingResponse || status !== 'connected'}
                  className="bg-[#D93829] hover:bg-[#C22F21] text-white font-semibold text-xs px-4 py-2 rounded-xl gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" /> Submit Answer
                </Button>

                {(readyToFinish || questionCount >= 3) && (
                  <Button
                    onClick={() => void handleFinish()}
                    disabled={status === 'finishing'}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl gap-1.5 shadow-md"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Finish &amp; Score
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
