'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Construction,
  Flame,
  LayoutDashboard,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface InterviewLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToDashboard?: () => void;
}

const PRO_TIER_PERKS = [
  'Unlimited live AI technical vivas (Round 1 voice evaluation)',
  'Unlimited full-screen coding IDE & DSA rounds (Round 2)',
  'Comprehensive scorecards, rubric grading & proctored audit logs',
] as const;

export function InterviewLimitModal({
  isOpen,
  onClose,
  onReturnToDashboard,
}: InterviewLimitModalProps) {
  const router = useRouter();
  const [tilt, setTilt] = useState<{ rotateX: number; rotateY: number }>({
    rotateX: 0,
    rotateY: 0,
  });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    setTilt({ rotateX, rotateY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  const handleReturnToDashboard = () => {
    if (onReturnToDashboard) {
      onReturnToDashboard();
    } else {
      router.push('/dashboard');
      onClose();
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <DialogPrimitive.Portal forceMount>
            {/* Backdrop with dark blur */}
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md"
              />
            </DialogPrimitive.Overlay>

            {/* Modal Container with 3D perspective */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 [perspective:1200px]">
              <DialogPrimitive.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, rotateX: 14, y: 32 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    rotateX: tilt.rotateX,
                    rotateY: tilt.rotateY,
                    y: 0,
                  }}
                  exit={{ opacity: 0, scale: 0.92, rotateX: -8, y: 20 }}
                  transition={{
                    type: 'spring',
                    damping: 24,
                    stiffness: 280,
                    mass: 0.8,
                  }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  style={{ transformStyle: 'preserve-3d' }}
                  data-testid="interview-limit-modal"
                  className={cn(
                    'relative w-full max-w-lg overflow-hidden rounded-2xl border',
                    'border-[#D93829]/40 bg-[#28201E]',
                    'p-6 sm:p-8 text-stone-200',
                    'shadow-[0_0_60px_-12px_rgba(217,56,41,0.35)]',
                    'transition-shadow duration-300 hover:shadow-[0_0_75px_-10px_rgba(217,56,41,0.45)]'
                  )}
                >
                  {/* Warm Lava & Embers Ambient Glows */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-24 left-1/2 h-56 w-80 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#D93829]/35 via-[#FF6B4A]/15 to-transparent blur-3xl"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-20 -right-20 h-44 w-44 rounded-full bg-[#D93829]/15 blur-2xl"
                  />

                  {/* Top Close Button */}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close paywall modal"
                    className="absolute right-4 top-4 rounded-xl p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#D93829]"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Header / Ember Icon */}
                  <div className="relative flex flex-col items-center text-center">
                    <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D93829]/50 bg-gradient-to-br from-[#D93829]/25 via-stone-900 to-[#1a1310] shadow-[0_0_30px_rgba(217,56,41,0.4)]">
                      <Flame className="h-8 w-8 text-[#FF6B4A] animate-pulse" />
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#D93829] bg-[#28201E] text-[#FF6B4A]">
                        <Zap className="h-3 w-3" />
                      </span>
                    </div>

                    {/* Exact Title */}
                    <DialogPrimitive.Title className="text-2xl font-bold tracking-tight text-stone-100 sm:text-3xl">
                      Free Tier Exhausted
                    </DialogPrimitive.Title>

                    {/* Exact Body Copy */}
                    <DialogPrimitive.Description className="mt-3 text-sm leading-relaxed text-stone-300">
                      You have completed your 3 free mock interviews. To continue practicing and access unlimited AI vivas and coding rounds, upgrade to the Pro tier.
                    </DialogPrimitive.Description>
                  </div>

                  {/* Notice/Badge: Payment Gateway Under Construction */}
                  <div className="relative mt-5 overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 p-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <Construction className="h-4 w-4 text-amber-400 animate-bounce" />
                      <span
                        data-testid="construction-badge"
                        className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300"
                      >
                        Payment Gateway Under Construction
                      </span>
                    </div>
                    <p className="mt-1.5 text-center text-[11px] leading-tight text-amber-200/80">
                      Direct subscription checkout is currently rolling out. Pro slots will be available shortly.
                    </p>
                  </div>

                  {/* Pro Tier Value Showcase */}
                  <div className="mt-5 space-y-2 rounded-xl border border-stone-800/80 bg-stone-900/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
                      <Sparkles className="h-3.5 w-3.5 text-[#FF6B4A]" />
                      <span>Pro Tier Includes:</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-stone-400">
                      {PRO_TIER_PERKS.map((perk) => (
                        <li key={perk} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6B4A]" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onClose}
                      className="border border-stone-700/60 text-xs font-semibold text-stone-300 hover:bg-stone-800 hover:text-stone-100"
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      onClick={handleReturnToDashboard}
                      className="bg-[#D93829] text-xs font-semibold text-white shadow-md shadow-[#D93829]/25 transition-colors hover:bg-[#C22F21] active:bg-[#AB281B]"
                    >
                      <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                      Return to Dashboard
                    </Button>
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
