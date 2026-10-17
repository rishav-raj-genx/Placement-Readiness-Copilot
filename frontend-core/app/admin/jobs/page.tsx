'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Briefcase,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { DemoLabel } from '@/components/shared/demo-label';
import { useJobStore } from '@/stores/job-store';
import type { JobPosting, JobStatus } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase-client';
import { toast } from 'sonner';

type EmploymentType = JobPosting['employmentType'];

function isEmploymentType(value: string): value is EmploymentType {
  return ['full_time', 'part_time', 'contract', 'internship'].includes(value);
}

function isJobStatus(value: string): value is JobStatus {
  return value === 'published' || value === 'unpublished';
}

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  contract: 'Contract',
  internship: 'Internship',
};

export default function AdminJobsPage() {
  const { jobs, isHydrated, error, hydrate, addJob, updateJob, deleteJob, togglePublish } = useJobStore();
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<'full_time' | 'part_time' | 'contract' | 'internship'>('full_time');
  const [description, setDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [status, setStatus] = useState<JobStatus>('published');

  useEffect(() => {
    if (!isHydrated) void hydrate();
  }, [isHydrated, hydrate]);

  const openCreateForm = () => {
    setEditingJob(null);
    setTitle('');
    setCompany('');
    setLocation('');
    setEmploymentType('full_time');
    setDescription('');
    setRequiredSkills('');
    setApplicationUrl('');
    setStatus('published');
    setShowForm(true);
  };

  const openEditForm = (job: JobPosting) => {
    setEditingJob(job);
    setTitle(job.title);
    setCompany(job.company);
    setLocation(job.location);
    setEmploymentType(job.employmentType);
    setDescription(job.description);
    setRequiredSkills(job.requiredSkills.join(', '));
    setApplicationUrl(job.applicationUrl || '');
    setStatus(job.status);
    setShowForm(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!title.trim() || !company.trim() || !description.trim() || !applicationUrl.trim()) {
      toast.error('Title, company, description, and application URL are required');
      return;
    }
    try {
      const url = new URL(applicationUrl.trim());
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported protocol');
    } catch {
      toast.error('Enter a valid HTTP or HTTPS application URL');
      return;
    }
    const skills = requiredSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setIsMutating(true);
    try {
      const posting = {
        title: title.trim(),
        company: company.trim(),
        location: location.trim(),
        employmentType,
        description: description.trim(),
        requiredSkills: skills,
        applicationUrl: applicationUrl.trim(),
        status,
      };
      if (editingJob) {
        await updateJob(editingJob.id, posting);
        toast.success('Job posting updated');
      } else {
        await addJob(posting);
        toast.success('Job posting created');
      }
      setShowForm(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save the job posting.';
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (deleteId) {
      setIsMutating(true);
      try {
        await deleteJob(deleteId);
        toast.success('Job posting deleted');
        setDeleteId(null);
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete the job posting.';
        toast.error(message);
      } finally {
        setIsMutating(false);
      }
    }
  };

  const handleTogglePublish = async (id: string): Promise<void> => {
    try {
      await togglePublish(id);
      toast.success('Publication status updated');
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : 'Unable to update publication status.';
      toast.error(message);
    }
  };

  if (!isHydrated) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Job Management"
        description="Create, edit, publish, and delete job postings."
        action={
          <Button variant="brand" onClick={openCreateForm}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Posting
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {!isSupabaseConfigured && <DemoLabel />}
        <span className="text-xs text-muted-foreground">
          {isSupabaseConfigured
            ? 'Postings are stored in Supabase and published jobs appear on the student job board.'
            : 'Supabase is not configured; postings use the local development fallback.'}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground/80">
          Supabase could not be reached. {error}
        </div>
      )}

      {/* Jobs Table */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No job postings yet.</p>
              <Button variant="brand" onClick={openCreateForm}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create First Posting
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Company</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{job.company}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {employmentTypeLabels[job.employmentType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={job.status === 'published' ? 'bg-success/10 text-success' : ''}
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => void handleTogglePublish(job.id)}
                          title={job.status === 'published' ? 'Unpublish' : 'Publish'}
                        >
                          {job.status === 'published' ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditForm(job)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(job.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? 'Edit Job Posting' : 'New Job Posting'}</DialogTitle>
            <DialogDescription>
              {editingJob ? 'Update the job posting details.' : 'Create a new job posting for students.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Developer" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. TechCorp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. San Francisco, CA" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select value={employmentType} onValueChange={(value) => {
                  if (isEmploymentType(value)) setEmploymentType(value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-Time</SelectItem>
                    <SelectItem value="part_time">Part-Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Publication Status</Label>
                <Select value={status} onValueChange={(value) => {
                  if (isJobStatus(value)) setStatus(value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="unpublished">Unpublished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Job description..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Required Skills (comma-separated)</Label>
              <Input id="skills" value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="React, TypeScript, Tailwind CSS" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Application URL</Label>
              <Input id="url" value={applicationUrl} onChange={(e) => setApplicationUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isMutating}>Cancel</Button>
            <Button variant="brand" onClick={handleSave} disabled={isMutating}>
              {editingJob ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job posting?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The posting will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="text-destructive" disabled={isMutating}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
