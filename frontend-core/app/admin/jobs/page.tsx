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
  full_time: 'Full time',
  part_time: 'Part time',
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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="font-mono text-xs text-stone-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Job management"
        description="Create, edit, publish, and delete job postings."
        action={
          <Button
            onClick={openCreateForm}
            className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B] focus-visible:ring-2 focus-visible:ring-[#D93829]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New posting
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {!isSupabaseConfigured && <DemoLabel />}
        <span className="text-xs text-stone-400">
          {isSupabaseConfigured
            ? 'Postings are stored in Supabase and published jobs appear on the student job board.'
            : 'Supabase is not configured; postings use the local development fallback.'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-300">
          Supabase could not be reached. {error}
        </div>
      )}

      {/* Jobs Table */}
      {jobs.length === 0 ? (
        <Card className="rounded-xl border border-stone-800 bg-[#121826] shadow-none">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <Briefcase className="h-8 w-8 text-stone-500" />
              <p className="text-sm text-stone-400">No job postings yet.</p>
              <Button
                onClick={openCreateForm}
                className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create first posting
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border border-stone-800 bg-[#121826] shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-stone-800 hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-stone-400">Title</TableHead>
                  <TableHead className="hidden font-mono text-xs uppercase tracking-wider text-stone-400 md:table-cell">Company</TableHead>
                  <TableHead className="hidden font-mono text-xs uppercase tracking-wider text-stone-400 sm:table-cell">Type</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-stone-400">Status</TableHead>
                  <TableHead className="text-right font-mono text-xs uppercase tracking-wider text-stone-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="border-b border-stone-800/80 transition-colors hover:bg-stone-900/40">
                    <TableCell className="font-medium text-stone-100">{job.title}</TableCell>
                    <TableCell className="hidden text-xs text-stone-400 md:table-cell">{job.company}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="border-stone-700 bg-stone-800 text-xs text-stone-300">
                        {employmentTypeLabels[job.employmentType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={job.status === 'published' ? 'border border-stone-700 bg-stone-800 text-stone-200' : 'border border-stone-800 bg-stone-900 text-stone-500'}
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
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
                          className="h-8 w-8 text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                          onClick={() => openEditForm(job)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-stone-400 hover:bg-[#D93829]/15 hover:text-[#D93829]"
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
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-xl border border-stone-800 bg-[#121826] text-stone-200 shadow-lg shadow-black/50">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-stone-100">
              {editingJob ? 'Edit job posting' : 'New job posting'}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              {editingJob ? 'Update the job posting details.' : 'Create a new job posting for students.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium text-stone-300">Job title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Developer"
                className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus:border-[#D93829] focus:ring-[#D93829]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-xs font-medium text-stone-300">Company</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. TechCorp"
                  className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus:border-[#D93829] focus:ring-[#D93829]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-xs font-medium text-stone-300">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                  className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus:border-[#D93829] focus:ring-[#D93829]"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-300">Employment type</Label>
                <Select value={employmentType} onValueChange={(value) => {
                  if (isEmploymentType(value)) setEmploymentType(value);
                }}>
                  <SelectTrigger className="border-stone-800 bg-stone-900 text-stone-200 focus:ring-[#D93829]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-stone-800 bg-[#121826] text-stone-200">
                    <SelectItem value="full_time">Full time</SelectItem>
                    <SelectItem value="part_time">Part time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-300">Publication status</Label>
                <Select value={status} onValueChange={(value) => {
                  if (isJobStatus(value)) setStatus(value);
                }}>
                  <SelectTrigger className="border-stone-800 bg-stone-900 text-stone-200 focus:ring-[#D93829]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-stone-800 bg-[#121826] text-stone-200">
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="unpublished">Unpublished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium text-stone-300">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Job description..."
                className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus:border-[#D93829] focus:ring-[#D93829]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skills" className="text-xs font-medium text-stone-300">Required skills (comma-separated)</Label>
              <Input
                id="skills"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="React, TypeScript, Tailwind CSS"
                className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus:border-[#D93829] focus:ring-[#D93829]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url" className="text-xs font-medium text-stone-300">Application URL</Label>
              <Input
                id="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://..."
                className="border-stone-800 bg-stone-900 text-stone-200 placeholder:text-stone-500 focus:border-[#D93829] focus:ring-[#D93829]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowForm(false)}
              disabled={isMutating}
              className="text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isMutating}
              className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B]"
            >
              {editingJob ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-xl border border-stone-800 bg-[#121826] text-stone-200 shadow-lg shadow-black/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-stone-100">Delete this job posting?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-stone-400">
              This action cannot be undone. The posting will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-stone-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-lg bg-[#D93829] text-xs font-semibold text-white hover:bg-[#C22F21]"
              disabled={isMutating}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
