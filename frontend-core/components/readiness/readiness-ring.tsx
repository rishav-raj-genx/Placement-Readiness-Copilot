'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface ReadinessRingProps { score?: number; level?: string; }

export function ReadinessRing({ score, level = 'Building readiness' }: ReadinessRingProps) {
  const reduceMotion = useReducedMotion();
  const normalized = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0;
  const circumference = 2 * Math.PI * 82;
  return (
    <div className="relative grid h-56 w-56 place-items-center" role="img" aria-label={`Readiness score ${Math.round(normalized)} percent, ${level}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
        <circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" strokeWidth="10" className="text-stone-800" />
        <motion.circle
          cx="100"
          cy="100"
          r="82"
          fill="none"
          stroke="#D93829"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - normalized / 100) }}
          transition={{ duration: reduceMotion ? 0 : 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="relative text-center">
        <p className="font-display text-5xl font-bold tracking-tight text-stone-100">{Math.round(normalized)}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-stone-400">{level}</p>
      </div>
    </div>
  );
}
