'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { calculateRemainingSeconds, getCountdownTone } from '@/lib/countdown';

interface CountdownTimerProps { startedAt: string; durationMinutes: number; onExpire: () => void; }

export function CountdownTimer({ startedAt, durationMinutes, onExpire }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => calculateRemainingSeconds(startedAt, durationMinutes));
  const expired = useRef(false);
  useEffect(() => {
    const tick = () => {
      const next = calculateRemainingSeconds(startedAt, durationMinutes);
      setRemaining(next);
      if (next === 0 && !expired.current) { expired.current = true; onExpire(); }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [durationMinutes, onExpire, startedAt]);
  const tone = getCountdownTone(remaining);
  const color = tone === 'green' ? 'text-orange-400 bg-orange-500/10' : tone === 'yellow' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  return <span className={`inline-flex items-center rounded-full px-3 py-1.5 font-mono text-sm ${color}`} aria-live={remaining <= 60 ? 'polite' : 'off'}><Clock className="mr-2 h-3.5 w-3.5" />{minutes}:{seconds}</span>;
}
