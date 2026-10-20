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
      className="fixed inset-0 z-[-1] flex items-center justify-center pointer-events-none select-none overflow-hidden"
    >
      <div className="relative flex items-center justify-center">
        {/* Layer 1 (The Faded Base): faint outline before scrolling */}
        <img
          src="/brand-mark.png"
          alt=""
          aria-hidden="true"
          className="h-[460px] w-auto max-w-[85vw] object-contain opacity-10 grayscale sm:h-[580px] xl:h-[680px]"
        />

        {/* Layer 2 (The Vibrant Fill): revealed from bottom to top via clip-path */}
        <motion.div
          style={{ clipPath }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <img
            src="/brand-mark.png"
            alt=""
            aria-hidden="true"
            className="h-[460px] w-auto max-w-[85vw] object-contain opacity-100 drop-shadow-[0_0_30px_rgba(99,102,241,0.5)] sm:h-[580px] xl:h-[680px]"
          />
        </motion.div>
      </div>
    </div>
  );
}
