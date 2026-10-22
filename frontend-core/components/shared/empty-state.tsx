import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center select-none', className)}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-800 bg-[#28201E]/90 text-stone-400 shadow-inner shadow-black/40 transition-colors">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-bold tracking-tight text-stone-100">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-xs leading-relaxed text-stone-400">{description}</p>
      )}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}

export default EmptyState;
