'use client';

import { useId, useRef, useState } from 'react';
import { FileCheck2, FileUp } from 'lucide-react';

interface SignupPdfDropzoneProps {
  label: string;
  description: string;
  accent?: 'indigo' | 'cyan' | 'lava';
  file: File | null;
  existingDocument?: boolean;
  error: string | null;
  progress: number;
  accept?: string;
  fileTypeLabel?: string;
  onChange: (file: File) => void;
}

export function SignupPdfDropzone({
  label,
  description,
  file,
  existingDocument = false,
  error,
  progress,
  accept = 'application/pdf,.pdf',
  fileTypeLabel = 'PDF ≤ 10 MB',
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
        <label htmlFor={inputId} className="text-xs font-medium text-stone-300">
          {label}
        </label>
        <span className="font-mono text-xs text-stone-500">{fileTypeLabel}</span>
      </div>
      <button
        type="button"
        className={`group relative flex w-full flex-col items-center justify-center rounded-xl border border-dashed p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#D93829] focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 ${
          hasDocument || dragging
            ? 'border-[#D93829] bg-[#D93829]/10'
            : 'border-stone-800 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-900'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const droppedFile = event.dataTransfer.files[0];
          if (droppedFile) onChange(droppedFile);
        }}
        aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
      >
        {hasDocument ? (
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-[#D93829]">
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block max-w-[18rem] truncate text-xs font-semibold text-stone-100">
                {file?.name ?? 'Stored securely'}
              </span>
              <span id={helpId} className="block text-xs text-stone-400">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Click to replace` : 'Click to replace this PDF'}
              </span>
            </span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1.5 py-1 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-800 bg-stone-900 text-stone-400">
              <FileUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <span id={helpId} className="text-xs text-stone-300">{description}</span>
          </span>
        )}

        {/* Progress Bar */}
        {progress > 0 && progress < 100 && (
          <div className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full rounded-full bg-[#D93829] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
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
          const selectedFile = event.target.files?.[0];
          if (selectedFile) onChange(selectedFile);
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default SignupPdfDropzone;
