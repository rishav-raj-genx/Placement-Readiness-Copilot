'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyCardProps { text: string; label?: string; }

export function CopyCard({ text, label = 'Recommendation' }: CopyCardProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };
  return (
    <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.07] p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-medium uppercase tracking-[0.14em] text-violet-200">{label}</span><Button variant="ghost" size="sm" onClick={() => void copy()} aria-live="polite">{copied ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</Button></div>
      <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-slate-200">{text}</pre>
    </div>
  );
}
