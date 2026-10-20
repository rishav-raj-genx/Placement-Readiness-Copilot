import type { ReadinessBreakdownItem } from '@/types';

interface BreakdownMeterProps { label: string; value?: ReadinessBreakdownItem; }

export function BreakdownMeter({ label, value }: BreakdownMeterProps) {
  const rawScore = typeof value?.rawScore === 'number' && Number.isFinite(value.rawScore) ? value.rawScore : 0;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  return (
    <div className="space-y-2" aria-label={`${label} score ${score} out of 100`}>
      <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-300">{label}</span><span className="font-medium text-white">{score}<span className="text-white/40">/100</span></span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-[width]" style={{ width: `${score}%` }} /></div>
    </div>
  );
}
