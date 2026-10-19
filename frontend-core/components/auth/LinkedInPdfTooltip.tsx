'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Download, MoreHorizontal, ArrowRight, X } from 'lucide-react';

export function LinkedInPdfTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300"
        aria-label="How to get LinkedIn PDF"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span>How to export LinkedIn PDF?</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-2xl border border-white/10 bg-[#101827]/95 p-4 shadow-2xl backdrop-blur-xl sm:w-80"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="font-[var(--font-display)] text-xs font-bold text-white">
                How to Export LinkedIn PDF
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 text-xs text-white/70">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                  1
                </span>
                <p>
                  Go to your personal <strong className="text-white">LinkedIn Profile</strong> page.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                  2
                </span>
                <p>
                  Click the <strong className="text-white">&ldquo;More&rdquo;</strong> button (with{' '}
                  <MoreHorizontal className="inline h-3.5 w-3.5 text-white/80" /> icon) near your
                  profile header.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                  3
                </span>
                <p>
                  Select <strong className="text-cyan-300">&ldquo;Save to PDF&rdquo;</strong> from the dropdown menu
                  to download your profile summary.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                  4
                </span>
                <p>Drag and drop that downloaded PDF file directly into this dropzone.</p>
              </div>
            </div>

            {/* Visual Animated Preview */}
            <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-2">
              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span>Profile Header</span>
                <span className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-cyan-300">
                  <Download className="h-2.5 w-2.5" /> Save to PDF
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
