'use client';

import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ApplicationStatus, JobApplication } from '@/types';

const columns: Array<{ id: ApplicationStatus; label: string }> = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
];

interface ApplicationKanbanProps {
  applications: JobApplication[];
  onMove: (id: string, status: ApplicationStatus) => Promise<void>;
}

export function ApplicationKanban({ applications, onMove }: ApplicationKanbanProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const dragEnd = (event: DragEndEvent) => {
    const status = event.over?.id;
    if (typeof status === 'string' && columns.some((column) => column.id === status)) {
      void onMove(String(event.active.id), status as ApplicationStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={dragEnd}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            applications={applications.filter((application) => application.status === column.id)}
            onMove={onMove}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  column,
  applications,
  onMove,
}: {
  column: { id: ApplicationStatus; label: string };
  applications: JobApplication[];
  onMove: ApplicationKanbanProps['onMove'];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      className={`min-h-48 rounded-xl border p-3.5 transition-colors ${
        isOver
          ? 'border-[#D93829] bg-[#D93829]/10'
          : 'border-stone-800 bg-[#28201E]/60'
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-300">{column.label}</h2>
        <span className="rounded border border-stone-700 bg-stone-800 px-2 py-0.5 font-mono text-xs text-stone-300">
          {applications.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {applications.map((application) => (
          <ApplicationCard key={application.id} application={application} onMove={onMove} />
        ))}
      </div>
    </section>
  );
}

function ApplicationCard({
  application,
  onMove,
}: {
  application: JobApplication;
  onMove: ApplicationKanbanProps['onMove'];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: application.id });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className={`rounded-lg border border-stone-800 bg-stone-900 p-3 shadow-sm transition-colors ${
        isDragging ? 'z-50 border-[#D93829] opacity-80' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-stone-500 hover:text-stone-300"
          aria-label={`Drag ${application.jobTitle}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-stone-200">{application.jobTitle}</p>
          <p className="truncate text-xs text-stone-400">{application.company}</p>
        </div>
      </div>
      <Select
        value={application.status}
        onValueChange={(value: ApplicationStatus) => void onMove(application.id, value)}
      >
        <SelectTrigger className="mt-2.5 h-7 border-stone-800 bg-stone-950/80 text-xs text-stone-300 focus:ring-[#D93829]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-stone-800 bg-[#28201E] text-stone-200">
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </article>
  );
}
