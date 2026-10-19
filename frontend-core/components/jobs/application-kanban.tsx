'use client';

import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ApplicationStatus, JobApplication } from '@/types';

const columns: Array<{ id: ApplicationStatus; label: string }> = [
  { id: 'saved', label: 'Saved' }, { id: 'applied', label: 'Applied' }, { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interviewing', label: 'Interviewing' }, { id: 'offer', label: 'Offer' }, { id: 'rejected', label: 'Rejected' },
];

interface ApplicationKanbanProps { applications: JobApplication[]; onMove: (id: string, status: ApplicationStatus) => Promise<void>; }

export function ApplicationKanban({ applications, onMove }: ApplicationKanbanProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));
  const dragEnd = (event: DragEndEvent) => {
    const status = event.over?.id;
    if (typeof status === 'string' && columns.some((column) => column.id === status)) void onMove(String(event.active.id), status as ApplicationStatus);
  };
  return <DndContext sensors={sensors} onDragEnd={dragEnd}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{columns.map((column) => <Column key={column.id} column={column} applications={applications.filter((application) => application.status === column.id)} onMove={onMove} />)}</div></DndContext>;
}

function Column({ column, applications, onMove }: { column: { id: ApplicationStatus; label: string }; applications: JobApplication[]; onMove: ApplicationKanbanProps['onMove'] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return <section ref={setNodeRef} className={`min-h-48 rounded-2xl border p-3 ${isOver ? 'border-indigo-400/50 bg-indigo-500/[0.08]' : 'border-white/10 bg-slate-950/40'}`}><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-sm font-medium">{column.label}</h2><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-muted-foreground">{applications.length}</span></div><div className="space-y-3">{applications.map((application) => <ApplicationCard key={application.id} application={application} onMove={onMove} />)}</div></section>;
}

function ApplicationCard({ application, onMove }: { application: JobApplication; onMove: ApplicationKanbanProps['onMove'] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: application.id });
  return <article ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }} className={`rounded-xl border border-white/[0.08] bg-slate-900 p-3 shadow-lg ${isDragging ? 'z-50 opacity-80' : ''}`}><div className="flex items-start gap-2"><button type="button" className="mt-0.5 cursor-grab touch-none text-muted-foreground" aria-label={`Drag ${application.jobTitle}`} {...listeners} {...attributes}><GripVertical className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{application.jobTitle}</p><p className="truncate text-xs text-muted-foreground">{application.company}</p></div></div><Select value={application.status} onValueChange={(value: ApplicationStatus) => void onMove(application.id, value)}><SelectTrigger className="mt-3 h-8 text-xs" aria-label={`Change status for ${application.jobTitle}`}><SelectValue /></SelectTrigger><SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.label}</SelectItem>)}</SelectContent></Select></article>;
}
