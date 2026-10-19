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

  // Alternating Electric Indigo (#6366F1) and Cyan (#06B6D4)
  const colors = ['#6366F1', '#06B6D4', '#6366F1', '#06B6D4', '#818CF8'];
  return {
    d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    stroke: colors[i],
  };
});

export function SegmentedLoader({
  message = 'Building your Copilot...',
  subtitle = 'Syncing Candidate Profile...',
  fullScreen = true,
}: SegmentedLoaderProps) {
  const content = (
    <div className="relative flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Ambient Pulsing Glow Background */}
      <motion.div
        animate={{
          scale: [0.95, 1.15, 0.95],
          opacity: [0.15, 0.35, 0.15],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: 'easeInOut',
        }}
        className="pointer-events-none absolute h-52 w-52 rounded-full bg-gradient-to-tr from-indigo-500 via-cyan-500 to-indigo-600 blur-3xl"
      />

      {/* The 5-Segment Broken Circle SVG Container */}
      <div className="relative flex h-32 w-32 items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="relative h-28 w-28"
          style={{
            filter: 'drop-shadow(0 0 12px rgba(6,182,212,0.65)) drop-shadow(0 0 22px rgba(99,102,241,0.5))',
          }}
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
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            ))}
          </svg>
        </motion.div>

        {/* Center glowing reticle core */}
        <motion.div
          animate={{
            scale: [0.8, 1.2, 0.8],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#06B6D4]"
        />
      </div>

      {/* Typography: Pulsing Status Text */}
      <motion.div
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        className="mt-6 flex flex-col items-center gap-1.5"
      >
        <p className="font-[var(--font-display)] text-base font-bold tracking-wider text-white sm:text-lg">
          {message}
        </p>
        {subtitle && (
          <p className="font-mono text-xs text-cyan-300/80 tracking-wide">
            {subtitle}
          </p>
        )}
      </motion.div>
    </div>
  );

  if (!fullScreen) return content;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex min-h-screen w-screen items-center justify-center bg-[#0B0F17]"
    >
      {content}
    </div>
  );
}

export default SegmentedLoader;
