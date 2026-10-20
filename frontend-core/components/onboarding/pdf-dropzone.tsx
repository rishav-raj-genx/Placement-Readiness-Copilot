'use client';

import { useRef, useState } from 'react';
import { FileCheck2, FileUp, Replace } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { validatePdf } from '@/lib/onboarding';

interface PdfDropzoneProps {
  label: string;
  file: File | null;
  existingPath?: string;
  progress: number;
  onChange: (file: File) => void;
}

export function PdfDropzone({ label, file, existingPath, progress, onChange }: PdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acceptFile = (nextFile?: File) => {
    if (!nextFile) return;
    const validationError = validatePdf(nextFile);
    if (validationError) { setError(validationError); return; }
    setError(null);
    onChange(nextFile);
  };
  const hasDocument = Boolean(file || existingPath);

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}
        className={cn('w-full rounded-2xl border border-dashed p-6 text-left transition-colors', dragging ? 'border-[#D93829] bg-[#D93829]/10' : 'border-stone-800 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-900')}
        aria-label={`${hasDocument ? 'Replace' : 'Upload'} ${label} PDF`}
      >
        <span className="flex items-center gap-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-stone-800 text-[#D93829]">{hasDocument ? <FileCheck2 className="h-5 w-5" /> : <FileUp className="h-5 w-5 text-stone-400" />}</span>
          <span className="min-w-0 flex-1"><span className="block font-medium text-stone-100">{label}</span><span className="block truncate text-sm text-stone-400">{file?.name ?? (existingPath ? 'Stored securely — choose a file to replace it' : 'Drop a PDF here or browse · max 10 MB')}</span></span>
          {hasDocument && <Replace className="h-4 w-4 text-stone-400" />}
        </span>
      </button>
      <input ref={inputRef} className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => acceptFile(event.target.files?.[0])} />
      {progress > 0 && progress < 100 && <Progress value={progress} className="mt-2 h-1.5" aria-label={`${label} upload progress`} />}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
