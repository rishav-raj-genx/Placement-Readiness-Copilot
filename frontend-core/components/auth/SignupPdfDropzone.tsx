'use client';

import { useId, useRef, useState } from 'react';
import { FileCheck2, FileUp } from 'lucide-react';
import { validatePdf } from '@/lib/onboarding';

interface SignupPdfDropzoneProps {
  label: string;
  description: string;
  accent: 'indigo' | 'cyan';
  file: File | null;
  existingDocument?: boolean;
  error: string | null;
  progress: number;
  onChange: (file: File) => void;
}

const accentClasses = {
  indigo: 'border-indigo-400 bg-indigo-500/10 focus-visible:ring-indigo-400',
  cyan: 'border-cyan-400 bg-cyan-500/10 focus-visible:ring-cyan-400',
} as const;

export function SignupPdfDropzone({
  label,
  description,
  accent,
  file,
  existingDocument = false,
  error,
  progress,
  onChange,
}: SignupPdfDropzoneProps) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const hasDocument = Boolean(file || existingDocument);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={inputId} className="text-xs font-semibold text-white/70">
          {label} <span className="text-rose-400">*</span>
        </label>
        <span className="font-mono text-[10px] text-white/40">PDF ≤ 10 MB</span>
      </div>
      <button
        type="button"
        className={`group relative flex w-full flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101827] ${
          hasDocument || dragging
            ? accentClasses[accent]
            : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04] focus-visible:ring-white/60'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) onChange(file);
        }}
        aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
      >
        {hasDocument ? (
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
              <FileCheck2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block max-w-[18rem] truncate text-xs font-bold text-white">
                {file?.name ?? 'Stored securely'}
              </span>
              <span id={helpId} className="block text-[10px] text-white/45">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Click to replace` : 'Click to replace this PDF'}
              </span>
            </span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1.5 py-1 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/70">
              <FileUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <span id={helpId} className="text-xs font-medium text-white/80">{description}</span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-invalid={Boolean(error)}
        aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange(file);
        }}
      />
      {progress > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-label={`${label} upload progress`}>
          <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p id={errorId} role="alert" className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
