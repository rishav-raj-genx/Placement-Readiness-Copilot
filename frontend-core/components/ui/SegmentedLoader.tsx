'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SegmentedLoaderProps {
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
}

// 5 evenly spaced curved segments along a circle of radius R=44 at center (60, 60)
const SEGMENTS = Array.from({ length: 5 }, (_, i) => {
  const centerAngleDeg = i * 72 - 90;
  const halfSpanDeg = 25; // 50 deg arc, 22 deg gap between segments
  const startAngle = ((centerAngleDeg - halfSpanDeg) * Math.PI) / 180;
  const endAngle = ((centerAngleDeg + halfSpanDeg) * Math.PI) / 180;
  const r = 44;
  const cx = 60;
  const cy = 60;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);

  // Warm Lava palette: Lava Red and stone accents
  const colors = ['#D93829', '#A8A29E', '#78716C', '#D93829', '#57534E'];
  return {
    d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    stroke: colors[i],
  };
});

export function SegmentedLoader({
  message = 'Loading workspace…',
  subtitle = 'Syncing profile details…',
  fullScreen = true,
}: SegmentedLoaderProps) {
  const content = (
    <div className="relative flex select-none flex-col items-center justify-center p-6 text-center">
      {/* The 5-Segment Broken Circle SVG Container */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
          className="relative h-24 w-24"
        >
          <svg
            viewBox="0 0 120 120"
            className="h-full w-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {SEGMENTS.map((seg, idx) => (
              <path
                key={idx}
                d={seg.d}
                stroke={seg.stroke}
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))}
          </svg>
        </motion.div>

        {/* Center Lava Red core dot */}
        <motion.div
          animate={{
            scale: [0.85, 1.15, 0.85],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.4,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-[#D93829]"
        />
      </div>

      {/* Typography: Status Text */}
      <motion.div
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: 'easeInOut',
        }}
        className="mt-6 flex flex-col items-center"
      >
        <span className="font-[var(--font-display)] text-base font-bold tracking-tight text-stone-100 sm:text-lg">
          {message}
        </span>
        {subtitle && (
          <span className="mt-1 text-xs text-stone-400">
            {subtitle}
          </span>
        )}
      </motion.div>

      {/* Telemetry Indicator */}
      <div className="mt-4 flex items-center gap-1.5 rounded-md border border-stone-800 bg-stone-900 px-3 py-1 font-mono text-xs uppercase tracking-wider text-stone-400">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D93829]" />
        Secure sync
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a1310] text-stone-200">
        {content}
      </div>
    );
  }

  return content;
}

export default SegmentedLoader;
