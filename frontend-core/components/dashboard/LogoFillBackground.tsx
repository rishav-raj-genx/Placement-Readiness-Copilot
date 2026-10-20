'use client';

import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform } from 'framer-motion';

export function LogoFillBackground() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const fillPercentage = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [100, 0]
  );
  const clipPath = useMotionTemplate`inset(${fillPercentage}% 0 0 0)`;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 flex items-center justify-center pointer-events-none select-none overflow-hidden"
    >
      <div className="relative -z-10 flex items-center justify-center pointer-events-none">
        {/* Layer 1 (The Faded Base): subtle muted watermark before scrolling */}
        <img
          src="/brand-mark.png"
          alt=""
          aria-hidden="true"
          className="h-[460px] w-auto max-w-[85vw] object-contain opacity-5 grayscale blur-[2px] sm:h-[580px] xl:h-[680px]"
        />

        {/* Layer 2 (The Vibrant Fill): subtle watermark reveal blended softly into background */}
        <motion.div
          style={{ clipPath }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <img
            src="/brand-mark.png"
            alt=""
            aria-hidden="true"
            className="h-[460px] w-auto max-w-[85vw] object-contain opacity-[0.18] mix-blend-screen sm:h-[580px] xl:h-[680px]"
          />
        </motion.div>
      </div>
    </div>
  );
}
