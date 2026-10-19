import type { ReadinessBreakdownItem } from '@/types';

interface BreakdownMeterProps { label: string; value?: ReadinessBreakdownItem; }

export function BreakdownMeter({ label, value }: BreakdownMeterProps) {
  const score = value?.present ? Math.round(value.rawScore) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-300">{label}</span><span className={score === null ? 'text-muted-foreground' : 'font-medium text-white'}>{score === null ? 'Not assessed' : `${score}%`}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-[width]" style={{ width: `${score ?? 0}%` }} /></div>
    </div>
  );
}
