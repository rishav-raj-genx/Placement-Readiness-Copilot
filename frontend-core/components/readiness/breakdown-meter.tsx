import type { ReadinessBreakdownItem } from '@/types';

interface BreakdownMeterProps {
  label: string;
  value?: ReadinessBreakdownItem;
  maxPoints?: number;
}

export function BreakdownMeter({ label, value, maxPoints = 20 }: BreakdownMeterProps) {
  const rawScore = typeof value?.rawScore === 'number' && Number.isFinite(value.rawScore) ? value.rawScore : 0;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));
  const computedPoints = typeof value?.weightedPoints === 'number' && Number.isFinite(value.weightedPoints)
    ? value.weightedPoints
    : Math.round(score * (maxPoints / 100) * 10) / 10;
  const pointsFormatted = Number.isInteger(computedPoints) ? String(computedPoints) : computedPoints.toFixed(1);

  return (
    <div className="space-y-2" aria-label={`${label} score ${score} out of 100`}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-stone-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-orange-400">
            {pointsFormatted} / {maxPoints} pts
          </span>
          <span className="font-semibold text-stone-100">
            {score}<span className="text-stone-500">/100</span>
          </span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-800" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-600 transition-[width] duration-500 ease-out"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
