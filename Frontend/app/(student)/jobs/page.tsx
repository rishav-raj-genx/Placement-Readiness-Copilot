'use client';

import { useState, useEffect } from 'react';
import {
  Briefcase,
  MapPin,
  Building2,
  ExternalLink,
  Search,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { DemoLabel } from '@/components/shared/demo-label';
import { EmptyState } from '@/components/shared/empty-state';
import { useJobStore } from '@/stores/job-store';
import { useApplicationStore } from '@/stores/application-store';
import { useAuthStore } from '@/stores/auth-store';
import type { JobPosting } from '@/types';
import { toast } from 'sonner';

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  contract: 'Contract',
  internship: 'Internship',
};

export default function JobsPage() {
  const { jobs, isHydrated, hydrate } = useJobStore();
  const { addApplication } = useApplicationStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveCompany, setSaveCompany] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
  const [saveUrl, setSaveUrl] = useState('');
  const [saveNotes, setSaveNotes] = useState('');

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  const publishedJobs = jobs.filter((j) => j.status === 'published');

  const filteredJobs = publishedJobs
    .filter((j) => typeFilter === 'all' || j.employmentType === typeFilter)
    .filter(
      (j) =>
        !search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.company.toLowerCase().includes(search.toLowerCase()) ||
        j.requiredSkills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
    );

  const handleSaveToTracker = (job: JobPosting) => {
    setSaveCompany(job.company);
    setSaveTitle(job.title);
    setSaveUrl(job.applicationUrl || '');
    setSaveNotes('');
    setSelectedJob(job);
    setSaveDialogOpen(true);
  };

  const confirmSave = () => {
    if (!user) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }
    addApplication({
      userId: user.id,
      company: saveCompany,
      jobTitle: saveTitle,
      status: 'saved',
      applicationDate: new Date().toISOString().split('T')[0],
      notes: saveNotes.trim(),
      jobPostingUrl: saveUrl.trim(),
    });
    toast.success('Saved to application tracker');
    setSaveDialogOpen(false);
  };

  if (!isHydrated) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Job Board"
        description="Browse job opportunities and save interesting ones to your tracker."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, company, or skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="full_time">Full-Time</SelectItem>
            <SelectItem value="part_time">Part-Time</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="internship">Internship</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Active opportunities aligned with your interview targets.
        </span>
      </div>

      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Briefcase className="h-6 w-6 text-muted-foreground" />}
              title="No jobs found"
              description="Try adjusting your search or filter to find more opportunities."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium">{job.title}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      {job.company}
                    </div>
                  </div>
                  <Badge variant="outline">{employmentTypeLabels[job.employmentType]}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => handleSaveToTracker(job)}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save to Tracker
                  </Button>
                  {job.applicationUrl && (
                    <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Apply
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Save to Tracker Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Application Tracker</DialogTitle>
            <DialogDescription>
              Review the details and add any notes before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="saveCompany">Company</Label>
              <Input id="saveCompany" value={saveCompany} onChange={(e) => setSaveCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saveTitle">Job Title</Label>
              <Input id="saveTitle" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saveUrl">Job Posting URL</Label>
              <Input id="saveUrl" value={saveUrl} onChange={(e) => setSaveUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saveNotes">Notes (Optional)</Label>
              <Textarea id="saveNotes" value={saveNotes} onChange={(e) => setSaveNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={confirmSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
