'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const COMMON_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Node.js',
  'Python',
  'Java',
  'C++',
  'SQL',
  'PostgreSQL',
  'AWS',
  'Docker',
  'Kubernetes',
  'Git',
  'REST APIs',
  'Machine Learning',
  'Data Structures',
  'System Design',
] as const;

interface SkillsComboboxProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase();
}

export function SkillsCombobox({ value, onChange, disabled = false }: SkillsComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => new Set(value.map(normalizeSkill)), [value]);
  const suggestions = useMemo(() => COMMON_SKILLS.filter((skill) => (
    skill.toLowerCase().includes(query.trim().toLowerCase()) && !selected.has(normalizeSkill(skill))
  )), [query, selected]);
  const trimmedQuery = query.trim();
  const canAddCustom = trimmedQuery.length > 0 && !selected.has(normalizeSkill(trimmedQuery));

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const addSkill = (skill: string): void => {
    const normalized = skill.trim();
    if (!normalized || selected.has(normalizeSkill(normalized))) return;
    onChange([...value, normalized]);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const removeSkill = (skill: string): void => {
    const target = normalizeSkill(skill);
    onChange(value.filter((item) => normalizeSkill(item) !== target));
  };

  return (
    <div ref={containerRef} className="relative">
      <div className={cn(
        'flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900/80 px-3 py-2 transition focus-within:border-[#D93829] focus-within:ring-1 focus-within:ring-[#D93829]',
        disabled && 'cursor-not-allowed opacity-50',
      )}>
        {value.map((skill) => (
          <span key={normalizeSkill(skill)} className="inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-800 px-2 py-0.5 text-xs font-medium text-stone-200">
            <Check className="h-3 w-3 text-[#D93829]" aria-hidden="true" />
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              disabled={disabled}
              aria-label={`Remove ${skill}`}
              className="rounded text-stone-400 hover:text-stone-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D93829]"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <div className="relative min-w-36 flex-1">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="msot-skill-options"
            autoComplete="off"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canAddCustom) {
                event.preventDefault();
                addSkill(trimmedQuery);
              }
              if (event.key === 'Backspace' && !query && value.length > 0) {
                removeSkill(value[value.length - 1]);
              }
            }}
            disabled={disabled}
            placeholder={value.length > 0 ? 'Add another skill…' : 'Search or add required skills…'}
            className="h-7 w-full bg-transparent pl-5 pr-6 text-sm text-stone-200 outline-none placeholder:text-stone-500"
          />
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            disabled={disabled}
            aria-label="Toggle skill suggestions"
            className="absolute right-0 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div id="msot-skill-options" role="listbox" className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-stone-800 bg-[#28201E] p-1.5 shadow-lg shadow-black/50">
          {canAddCustom && (
            <button
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => addSkill(trimmedQuery)}
              className="mb-1 flex w-full items-center gap-2 rounded-lg border border-stone-700 bg-stone-800/80 px-2.5 py-2 text-left text-xs font-medium text-stone-200 transition hover:bg-stone-700/80"
            >
              <Plus className="h-3.5 w-3.5 text-[#D93829]" aria-hidden="true" /> Add “{trimmedQuery}”
            </button>
          )}
          {suggestions.map((skill) => (
            <button
              key={skill}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => addSkill(skill)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-stone-300 transition hover:bg-stone-800 hover:text-stone-100"
            >
              {skill}<Plus className="h-3 w-3 text-stone-500" aria-hidden="true" />
            </button>
          ))}
          {!canAddCustom && suggestions.length === 0 && (
            <p className="px-3 py-3 text-center text-xs text-stone-400">All matching skills are selected.</p>
          )}
        </div>
      )}
    </div>
  );
}
