'use client';

import { useEffect, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { LiveKitTranscriptEntry } from '@/types';

interface TranscriptDrawerProps { transcripts: LiveKitTranscriptEntry[]; }

export function TranscriptDrawer({ transcripts }: TranscriptDrawerProps) {
  return <Sheet><SheetTrigger asChild><Button variant="outline"><MessageSquareText className="mr-2 h-4 w-4" />Transcript ({transcripts.length})</Button></SheetTrigger><SheetContent side="right" className="w-full border-white/10 bg-slate-950 sm:max-w-lg"><SheetHeader><SheetTitle>Live transcript</SheetTitle></SheetHeader><TranscriptList transcripts={transcripts} /></SheetContent></Sheet>;
}

function TranscriptList({ transcripts }: { transcripts: LiveKitTranscriptEntry[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcripts]);
  return <div className="mt-6 h-[calc(100vh-7rem)] space-y-3 overflow-y-auto pr-2" aria-live="polite">{transcripts.length === 0 && <p className="text-sm text-muted-foreground">Transcript entries will appear as the conversation begins.</p>}{transcripts.map((entry) => <div key={entry.id} className={`rounded-xl p-3 text-sm ${entry.speaker === 'student' ? 'ml-8 bg-indigo-500/15' : 'mr-8 bg-white/[0.05]'}`}><p className="mb-1 text-xs font-medium text-muted-foreground">{entry.speaker === 'student' ? 'You' : 'Interviewer'}</p><p>{entry.text}</p></div>)}<div ref={end} /></div>;
}
