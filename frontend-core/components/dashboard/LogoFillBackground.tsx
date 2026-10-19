'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

export function LogoFillBackground() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const clipY = useTransform(scrollYProgress, [0, 0.85], [400, 0]);
  const clipHeight = useTransform(scrollYProgress, [0, 0.85], [0, 400]);
  const opacityProgress = useTransform(scrollYProgress, [0, 0.15, 0.85], [0.08, 0.22, 0.35]);
  const scaleProgress = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
    >
      <motion.div
        style={{
          scale: reduceMotion ? 1 : scaleProgress,
          opacity: reduceMotion ? 0.12 : opacityProgress,
        }}
        className="relative flex items-center justify-center"
      >
        <svg
          className="h-[520px] w-[520px] sm:h-[680px] sm:w-[680px] xl:h-[780px] xl:w-[780px]"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* The Vibrant Electric Indigo to Cyan Fill Gradient */}
            <linearGradient id="logoFillGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#818CF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.95" />
            </linearGradient>

            {/* Glowing Drop Shadow Filter */}
            <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="16" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <clipPath id="scrollClipMask">
              <motion.rect
                x="0"
                width="400"
                style={{
                  y: reduceMotion ? 280 : clipY,
                  height: reduceMotion ? 120 : clipHeight,
                }}
              />
            </clipPath>
          </defs>

          {/* Background Ghost Outline of 'H' Logo */}
          <path
            d="M90 60 H150 V160 H250 V60 H310 V340 H250 V220 H150 V340 H90 Z"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
            strokeLinejoin="round"
            fill="rgba(255,255,255,0.015)"
          />

          {/* Dynamic Scroll-Filled 'H' with Vibrant Indigo / Cyan Gradient */}
          <g clipPath="url(#scrollClipMask)">
            <path
              d="M90 60 H150 V160 H250 V60 H310 V340 H250 V220 H150 V340 H90 Z"
              fill="url(#logoFillGrad)"
              filter="url(#logoGlow)"
              stroke="#06B6D4"
              strokeWidth="2"
              strokeOpacity="0.7"
            />
          </g>

          {/* Diagonal Corner Tech Accents */}
          <circle cx="90" cy="60" r="4" fill="#6366F1" opacity="0.6" />
          <circle cx="310" cy="60" r="4" fill="#06B6D4" opacity="0.6" />
          <circle cx="90" cy="340" r="4" fill="#06B6D4" opacity="0.6" />
          <circle cx="310" cy="340" r="4" fill="#6366F1" opacity="0.6" />
        </svg>
      </motion.div>
    </div>
  );
}
