'use client';

import { useEffect, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { LiveKitTranscriptEntry } from '@/types';

interface TranscriptDrawerProps {
  transcripts: LiveKitTranscriptEntry[];
}

export function TranscriptDrawer({ transcripts }: TranscriptDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="rounded-lg border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800"
        >
          <MessageSquareText className="mr-2 h-4 w-4 text-stone-400" />
          Transcript ({transcripts.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full border-stone-800 bg-[#28201E] sm:max-w-lg shadow-lg shadow-black/50">
        <SheetHeader>
          <SheetTitle className="text-base font-bold text-stone-100">Live transcript</SheetTitle>
        </SheetHeader>
        <TranscriptList transcripts={transcripts} />
      </SheetContent>
    </Sheet>
  );
}

function TranscriptList({ transcripts }: { transcripts: LiveKitTranscriptEntry[] }) {
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  return (
    <div className="mt-6 h-[calc(100vh-7rem)] space-y-3 overflow-y-auto pr-2" aria-live="polite">
      {transcripts.length === 0 && (
        <p className="text-xs text-stone-500">Transcript entries will appear as the conversation begins.</p>
      )}
      {transcripts.map((entry) => (
        <div
          key={entry.id}
          className={`rounded-xl p-3 text-xs leading-relaxed ${
            entry.speaker === 'student'
              ? 'ml-8 border border-[#D93829]/30 bg-[#D93829]/10 text-stone-100'
              : 'mr-8 border border-stone-800 bg-stone-900/80 text-stone-300'
          }`}
        >
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-stone-500">
            {entry.speaker === 'student' ? 'You' : 'Interviewer'}
          </p>
          <p>{entry.text}</p>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
