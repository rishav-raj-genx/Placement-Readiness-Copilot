'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Download, MoreHorizontal, X } from 'lucide-react';

export function LinkedInPdfTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 transition-colors hover:text-stone-200"
        aria-label="How to get LinkedIn PDF"
      >
        <HelpCircle className="h-3.5 w-3.5 text-[#D93829]" />
        <span>How to export LinkedIn PDF?</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-stone-800 bg-[#28201E] p-4 text-stone-200 shadow-lg shadow-black/50 sm:w-80"
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <span className="font-[var(--font-display)] text-xs font-bold text-stone-100">
                How to export LinkedIn PDF
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 text-xs text-stone-300">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-[#D93829]">
                  1
                </span>
                <p>
                  Go to your personal <strong className="text-stone-100">LinkedIn Profile</strong> page.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-[#D93829]">
                  2
                </span>
                <p>
                  Click the <strong className="text-stone-100">&ldquo;More&rdquo;</strong> button (with{' '}
                  <MoreHorizontal className="inline h-3.5 w-3.5 text-stone-400" /> icon) near your
                  profile header.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-[#D93829]">
                  3
                </span>
                <p>
                  Select <strong className="text-stone-100">&ldquo;Save to PDF&rdquo;</strong> from the dropdown menu
                  to download your profile summary.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-[#D93829]">
                  4
                </span>
                <p>Drag and drop that downloaded PDF file directly into this dropzone.</p>
              </div>
            </div>

            {/* Visual Preview */}
            <div className="mt-3 rounded-lg border border-stone-800 bg-stone-900/80 p-2">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Profile header</span>
                <span className="flex items-center gap-1 rounded border border-stone-700 bg-stone-800 px-1.5 py-0.5 text-stone-200">
                  <Download className="h-2.5 w-2.5 text-[#D93829]" /> Save to PDF
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LinkedInPdfTooltip;
