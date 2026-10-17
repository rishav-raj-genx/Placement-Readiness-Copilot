'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  FolderKanban,
  Trash2,
  Pencil,
  ExternalLink,
  Building2,
  Calendar,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { useApplicationStore } from '@/stores/application-store';
import { useAuthStore } from '@/stores/auth-store';
import type { JobApplication, ApplicationStatus } from '@/types';
import { toast } from 'sonner';

const columns: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: 'saved', label: 'Saved', color: 'bg-muted-foreground' },
  { status: 'applied', label: 'Applied', color: 'bg-warning' },
  { status: 'shortlisted', label: 'Shortlisted', color: 'bg-brand' },
  { status: 'interviewing', label: 'Interviewing', color: 'bg-brand' },
  { status: 'offer', label: 'Offer', color: 'bg-success' },
  { status: 'rejected', label: 'Rejected', color: 'bg-destructive' },
];

export default function ApplicationsPage() {
  const { applications, isHydrated, error, hydrate, addApplication, updateApplication, deleteApplication, moveApplication } =
    useApplicationStore();
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Form state
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [applicationDate, setApplicationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [jobPostingUrl, setJobPostingUrl] = useState('');

  useEffect(() => {
    if (user && !isHydrated) void hydrate(user.id);
  }, [isHydrated, hydrate, user]);

  const openCreateForm = () => {
    setEditingApp(null);
    setCompany('');
    setJobTitle('');
    setApplicationDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setJobPostingUrl('');
    setShowForm(true);
  };

  const openEditForm = (app: JobApplication) => {
    setEditingApp(app);
    setCompany(app.company);
    setJobTitle(app.jobTitle);
    setApplicationDate(app.applicationDate);
    setNotes(app.notes || '');
    setJobPostingUrl(app.jobPostingUrl || '');
    setShowForm(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!company.trim() || !jobTitle.trim()) {
      toast.error('Company and job title are required');
      return;
    }
    if (!user) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }
    try {
      if (editingApp) {
        await updateApplication(editingApp.id, {
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          applicationDate,
          notes: notes.trim(),
          jobPostingUrl: jobPostingUrl.trim(),
        });
        toast.success('Application updated');
      } else {
        await addApplication({
          userId: user.id,
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          status: 'saved',
          applicationDate,
          notes: notes.trim(),
          jobPostingUrl: jobPostingUrl.trim(),
        });
        toast.success('Application added');
      }
      setShowForm(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save the application.';
      toast.error(message);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (deleteId) {
      try {
        await deleteApplication(deleteId);
        toast.success('Application deleted');
        setDeleteId(null);
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete the application.';
        toast.error(message);
      }
    }
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDropForApplication = async (
    applicationId: string,
    status: ApplicationStatus
  ): Promise<void> => {
    try {
      await moveApplication(applicationId, status);
      toast.success(`Moved to ${columns.find((column) => column.status === status)?.label ?? status}`);
    } catch (moveError) {
      const message = moveError instanceof Error ? moveError.message : 'Unable to update application status.';
      toast.error(message);
    }
  };

  const handleDrop = async (status: ApplicationStatus): Promise<void> => {
    if (draggedId) {
      await handleDropForApplication(draggedId, status);
      setDraggedId(null);
    }
  };

  if (!isHydrated) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Application Tracker"
        description="Track your job applications across stages."
        action={
          <Button variant="brand" onClick={openCreateForm}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Application
          </Button>
        }
      />

      {error && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground/80">
          Supabase is unavailable; showing the local fallback data. {error}
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {columns.map((col) => {
          const colApps = applications.filter((a) => a.status === col.status);
          return (
            <div
              key={col.status}
              className="space-y-3"
              onDragOver={handleDragOver}
              onDrop={() => void handleDrop(col.status)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.color}`} />
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="text-xs text-muted-foreground">({colApps.length})</span>
                </div>
              </div>
              <div className="space-y-2 min-h-[200px] rounded-md border border-border bg-muted/20 p-2">
                {colApps.length === 0 ? (
                  <div className="flex h-32 items-center justify-center">
                    <span className="text-xs text-muted-foreground">Drag cards here</span>
                  </div>
                ) : (
                  colApps.map((app) => (
                    <Card
                      key={app.id}
                      draggable
                      onDragStart={() => handleDragStart(app.id)}
                      className="cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{app.jobTitle}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {app.company}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditForm(app)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteId(app.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Move to</DropdownMenuLabel>
                              {columns.map((statusOption) => (
                                <DropdownMenuItem
                                  key={statusOption.status}
                                  disabled={app.status === statusOption.status}
                                  onClick={() => void handleDropForApplication(app.id, statusOption.status)}
                                >
                                  {statusOption.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {app.applicationDate}
                        </div>
                        {app.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{app.notes}</p>
                        )}
                        {app.jobPostingUrl && (
                          <a
                            href={app.jobPostingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Job Posting
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {applications.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<FolderKanban className="h-6 w-6 text-muted-foreground" />}
              title="No applications yet"
              description="Add your first job application to start tracking your progress. You can also save jobs from the job board."
              action={
                <Button variant="brand" onClick={openCreateForm}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Application
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingApp ? 'Edit Application' : 'Add Application'}</DialogTitle>
            <DialogDescription>
              {editingApp ? 'Update the details of your application.' : 'Track a new job application.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Frontend Developer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Application Date</Label>
              <Input id="date" type="date" value={applicationDate} onChange={(e) => setApplicationDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Job Posting URL (Optional)</Label>
              <Input id="url" value={jobPostingUrl} onChange={(e) => setJobPostingUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this application..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="brand" onClick={handleSave}>
              {editingApp ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The application will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="text-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
