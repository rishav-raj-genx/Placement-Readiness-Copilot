'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  GripVertical,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Clock,
  Plus,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KANBAN_COLUMNS, type ApplicationStatus, type JobApplication } from '@/types';

export { KANBAN_COLUMNS };

interface ApplicationKanbanProps {
  applications: JobApplication[];
  onMove: (id: string, status: ApplicationStatus) => Promise<void>;
  onNewApplication?: () => void;
}

export function ApplicationKanban({
  applications,
  onMove,
  onNewApplication,
}: ApplicationKanbanProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const dragEnd = (event: DragEndEvent) => {
    const status = event.over?.id;
    if (typeof status === 'string' && KANBAN_COLUMNS.some((column) => column.id === status)) {
      void onMove(String(event.active.id), status as ApplicationStatus);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={dragEnd}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {KANBAN_COLUMNS.map((column) => (
          <Column
            key={column.id}
            column={column}
            applications={(applications ?? []).filter((application) => {
              // Normalize legacy 'interviewing' to 'interview' for column filtering
              const appStatus =
                application.status === 'interviewing' ? 'interview' : application.status;
              return appStatus === column.id;
            })}
            onMove={onMove}
            onNewApplication={column.id === 'saved' ? onNewApplication : undefined}
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
  onNewApplication,
}: {
  column: { id: ApplicationStatus; label: string };
  applications: JobApplication[];
  onMove: ApplicationKanbanProps['onMove'];
  onNewApplication?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const safeApps = applications ?? [];

  return (
    <section
      ref={setNodeRef}
      className={`min-h-56 rounded-xl border p-3.5 transition-colors ${
        isOver
          ? 'border-[#D93829] bg-[#D93829]/10'
          : 'border-stone-800 bg-[#28201E]/60'
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-300">
            {column.label}
          </h2>
          <span className="rounded border border-stone-700 bg-stone-800 px-2 py-0.5 font-mono text-xs text-stone-300">
            {safeApps.length}
          </span>
        </div>
        {onNewApplication && (
          <button
            type="button"
            onClick={onNewApplication}
            title="Create new saved application"
            className="inline-flex items-center gap-1 rounded bg-stone-800/80 px-2 py-0.5 text-[11px] font-medium text-stone-300 transition-colors hover:bg-stone-700 hover:text-stone-100"
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {safeApps.map((application) => (
          <ApplicationCard key={application.id} application={application} onMove={onMove} />
        ))}
        {safeApps.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-800/60 p-4 text-center text-[11px] text-stone-500">
            Drop cards here
          </div>
        )}
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });

  const appliedDate = application.applicationDate;
  const formattedApplied = appliedDate
    ? new Date(appliedDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // Follow-up status check
  const followUpDateObj = application.followUpDate ? new Date(application.followUpDate) : null;
  const isOverdue =
    followUpDateObj && !Number.isNaN(followUpDateObj.getTime())
      ? followUpDateObj.getTime() < Date.now()
      : false;

  const formattedFollowUp = followUpDateObj
    ? followUpDateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  // Normalized current status for dropdown
  const currentStatus =
    application.status === 'interviewing' ? 'interview' : application.status;

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      className={`rounded-lg border border-stone-800 bg-stone-900 p-3.5 shadow-sm transition-colors ${
        isDragging ? 'z-50 border-[#D93829] opacity-80' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-stone-500 hover:text-stone-300 active:cursor-grabbing"
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

      {/* Date Applied and Clickable Job Link */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800/80 pt-2 text-[11px]">
        {formattedApplied ? (
          <span className="inline-flex items-center gap-1 text-stone-400">
            <Calendar className="h-3 w-3 text-stone-500" />
            <span>Applied: {formattedApplied}</span>
          </span>
        ) : (
          <span className="text-stone-600">Date unrecorded</span>
        )}

        {application.jobPostingUrl && (
          <a
            href={application.jobPostingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#D93829] hover:underline"
          >
            <span>Job Link</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Follow-up reminder badge */}
      {application.followUpDate && (
        <div className="mt-2">
          {isOverdue ? (
            <span className="inline-flex items-center gap-1 rounded border border-red-800 bg-red-950/60 px-2 py-0.5 text-[10px] font-semibold text-red-300">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              Follow-up overdue ({formattedFollowUp})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded border border-stone-700 bg-stone-800 px-2 py-0.5 text-[10px] text-stone-300">
              <Clock className="h-3 w-3 text-stone-400" />
              Follow-up: {formattedFollowUp}
            </span>
          )}
        </div>
      )}

      {/* Status Selector */}
      <Select
        value={currentStatus}
        onValueChange={(value: ApplicationStatus) => void onMove(application.id, value)}
      >
        <SelectTrigger className="mt-2.5 h-7 border-stone-800 bg-stone-950/80 text-xs text-stone-300 focus:ring-[#D93829]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-stone-800 bg-[#28201E] text-stone-200">
          {KANBAN_COLUMNS.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </article>
  );
}

export default ApplicationKanban;
