'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Search,
  Copy,
  Check,
  Bot,
  User,
  Radio,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { LiveKitTranscriptEntry } from '@/types';
import { toast } from 'sonner';

interface InterviewAuditPlayerProps {
  audioUrl?: string | null;
  transcript: LiveKitTranscriptEntry[];
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimestampBadge(timestamp: number, baseTimestamp?: number): string {
  if (timestamp < 3600) {
    // Relative seconds already
    return formatTime(timestamp);
  }
  if (baseTimestamp && timestamp >= baseTimestamp) {
    // Epoch timestamp relative to start
    return formatTime((timestamp - baseTimestamp) / 1000);
  }
  return formatTime(timestamp % 3600);
}

export function InterviewAuditPlayer({ audioUrl, transcript }: InterviewAuditPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  const baseTimestamp = useMemo(() => {
    if (!transcript.length) return 0;
    const first = transcript[0].timestamp;
    return first > 100000 ? first : 0;
  }, [transcript]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play().catch(() => {
        toast.error('Unable to play audio stream.');
      });
    }
  }, [isPlaying]);

  const seek = useCallback((timeInSeconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(timeInSeconds, duration || 3600));
    if (!isPlaying) {
      void audioRef.current.play().catch(() => undefined);
    }
  }, [duration, isPlaying]);

  const jump = useCallback((deltaSeconds: number) => {
    if (!audioRef.current) return;
    seek(audioRef.current.currentTime + deltaSeconds);
  }, [seek]);

  const changeSpeed = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    audioRef.current.muted = next;
  }, [isMuted]);

  const copyTranscript = useCallback(() => {
    const text = transcript
      .map((entry) => `[${formatTimestampBadge(entry.timestamp, baseTimestamp)}] ${entry.speaker === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${entry.text}`)
      .join('\n\n');
    void navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast.success('Transcript copied to clipboard');
    setTimeout(() => setHasCopied(false), 2000);
  }, [transcript, baseTimestamp]);

  const filteredTranscript = useMemo(() => {
    if (!searchQuery.trim()) return transcript;
    const q = searchQuery.toLowerCase();
    return transcript.filter((t) => t.text.toLowerCase().includes(q) || t.speaker.toLowerCase().includes(q));
  }, [transcript, searchQuery]);

  return (
    <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none overflow-hidden">
      <CardHeader className="border-b border-stone-800/80 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#D93829]" />
              <CardTitle className="text-sm font-semibold text-stone-200">
                Auditable Session Recording &amp; Transcript
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-stone-400">
              Complete playback archive and timestamped transcript synchronized for audit evaluation.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyTranscript}
              disabled={transcript.length === 0}
              className="border-stone-800 bg-stone-900 text-xs text-stone-300 hover:bg-stone-800 h-8 gap-1.5"
            >
              {hasCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {hasCopied ? 'Copied' : 'Copy transcript'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-6">
        {/* Audio Player Controls */}
        {audioUrl ? (
          <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-4 space-y-3">
            <audio
              ref={audioRef}
              src={audioUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => {
                if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
              }}
              onLoadedMetadata={() => {
                if (audioRef.current) setDuration(audioRef.current.duration);
              }}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Scrubber Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-[#D93829]"
              />
            </div>

            {/* Playback Button Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => jump(-5)}
                  className="h-8 w-8 rounded-lg border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800"
                  title="Rewind 5s"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  onClick={togglePlay}
                  className="h-9 px-4 rounded-lg bg-[#D93829] hover:bg-[#C22F21] text-white font-semibold text-xs gap-1.5 shadow-md"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" /> Play audio
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => jump(5)}
                  className="h-8 w-8 rounded-lg border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800"
                  title="Forward 5s"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Speed Controls */}
              <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800">
                {([1, 1.25, 1.5, 2] as const).map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => changeSpeed(rate)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                      playbackRate === rate
                        ? 'bg-[#D93829] text-white'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-8 w-8 text-stone-400 hover:text-stone-200"
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const next = parseFloat(e.target.value);
                    setVolume(next);
                    if (audioRef.current) {
                      audioRef.current.volume = next;
                      audioRef.current.muted = false;
                    }
                    setIsMuted(false);
                  }}
                  className="w-16 h-1 bg-stone-800 rounded appearance-none cursor-pointer accent-[#D93829]"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-stone-800 bg-stone-900/40 p-3.5 text-xs text-stone-400">
            <Radio className="h-4 w-4 text-stone-500 shrink-0" />
            <span>
              Voice audio recording was not captured for this session (Text mode or microphone disabled). Verified chronological transcript is preserved below.
            </span>
          </div>
        )}

        {/* Filter Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript by keywords, concepts, or speaker..."
            className="pl-9 bg-stone-900 border-stone-800 text-xs text-stone-200 placeholder:text-stone-500"
          />
        </div>

        {/* Timestamped Transcript Stream */}
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {filteredTranscript.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-800 p-8 text-center text-xs text-stone-500">
              {transcript.length === 0
                ? 'No transcript events recorded for this session.'
                : 'No transcript entries match your search query.'}
            </div>
          ) : (
            filteredTranscript.map((entry, index) => {
              const isInterviewer = entry.speaker === 'interviewer';
              const timeDisplay = formatTimestampBadge(entry.timestamp, baseTimestamp);
              const timeSeconds = entry.timestamp < 3600
                ? entry.timestamp
                : baseTimestamp
                ? (entry.timestamp - baseTimestamp) / 1000
                : 0;

              return (
                <div
                  key={entry.id || index}
                  className={`flex gap-3 rounded-xl border p-3.5 transition-colors ${
                    isInterviewer
                      ? 'border-stone-800/90 bg-stone-900/60'
                      : 'border-stone-800/60 bg-[#1c1615]/70'
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

                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-stone-200">
                          {isInterviewer ? 'Interviewer (AI)' : 'Candidate (You)'}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] border-stone-800 bg-stone-950 text-stone-400 px-1.5 py-0"
                        >
                          {entry.final === false ? 'interim' : 'final'}
                        </Badge>
                      </div>

                      {audioUrl && (
                        <button
                          type="button"
                          onClick={() => seek(timeSeconds)}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-stone-500 hover:text-stone-300 transition-colors"
                          title="Click to jump audio here"
                        >
                          <Play className="h-2.5 w-2.5" />
                          [{timeDisplay}]
                        </button>
                      )}
                      {!audioUrl && (
                        <span className="font-mono text-[10px] text-stone-500">
                          [{timeDisplay}]
                        </span>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed text-stone-300 whitespace-pre-wrap">
                      {entry.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
