/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export function CustomCursor() {
  const [isHovered, setIsHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { damping: 25, stiffness: 400, mass: 0.2 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
      setIsDesktop(true);
    }

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);

      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const isClickable =
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'button';

      setIsHovered(isClickable);
    };

    window.addEventListener('mousemove', moveCursor);
    return () => window.removeEventListener('mousemove', moveCursor);
  }, [cursorX, cursorY]);

  if (!isDesktop) return null;

  return (
    <motion.img
      src="/pen.png"
      alt="cursor"
      className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[99999]"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        // Slight offset adjustment to ensure the exact pixel tip of the 180deg pen aligns with the actual DOM click target
        translateX: '-10%',
        translateY: '-10%',
      }}
      initial={{ rotate: 180, opacity: 0 }}
      animate={{
        rotate: 180,
        scale: isHovered ? 1.5 : 1,
        opacity: 1,
      }}
      transition={{
        scale: { type: 'spring', stiffness: 300, damping: 20 },
      }}
    />
  );
}

export default CustomCursor;
