'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface ReadinessRingProps { score?: number; level?: string; }

export function ReadinessRing({ score, level = 'Not assessed' }: ReadinessRingProps) {
  const reduceMotion = useReducedMotion();
  const normalized = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0;
  const circumference = 2 * Math.PI * 82;
  return (
    <div className="relative grid h-56 w-56 place-items-center" role="img" aria-label={typeof score === 'number' ? `Readiness score ${Math.round(score)} percent, ${level}` : 'Readiness not assessed'}>
      <div className="absolute inset-5 rounded-full bg-indigo-500/10 blur-2xl" />
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
        <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" />
        <motion.circle cx="100" cy="100" r="82" fill="none" stroke="url(#score-gradient)" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} initial={reduceMotion ? false : { strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * (1 - normalized / 100) }} transition={{ duration: reduceMotion ? 0 : 1, ease: 'easeOut' }} />
        <defs><linearGradient id="score-gradient"><stop stopColor="#818cf8" /><stop offset="1" stopColor="#c084fc" /></linearGradient></defs>
      </svg>
      <div className="relative text-center"><p className="text-5xl font-semibold tracking-tight">{typeof score === 'number' ? Math.round(score) : '—'}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{level}</p></div>
    </div>
  );
}
