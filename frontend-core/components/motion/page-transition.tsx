'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface PageTransitionProps { children: React.ReactNode; }

export function PageTransition({ children }: PageTransitionProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}
