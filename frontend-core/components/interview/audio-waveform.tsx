interface AudioWaveformProps {
  level: number;
  label: string;
}

export function AudioWaveform({ level, label }: AudioWaveformProps) {
  const normalized = Math.max(0, Math.min(1, level));
  return (
    <div
      className="flex items-center gap-1"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalized * 100)}
    >
      {[0.22, 0.42, 0.68, 0.9, 0.6, 0.35].map((threshold, index) => (
        <span
          key={index}
          className={`w-1 rounded-full transition-all ${
            normalized >= threshold ? 'bg-[#D93829]' : 'bg-stone-800'
          }`}
          style={{ height: `${10 + (index % 3) * 5}px` }}
        />
      ))}
    </div>
  );
}
