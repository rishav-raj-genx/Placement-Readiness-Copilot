'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BriefcaseBusiness, KanbanSquare, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApplicationKanban, KANBAN_COLUMNS } from '@/components/jobs/application-kanban';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApplicationStore } from '@/stores/application-store';
import { useAuthStore } from '@/stores/auth-store';
import type { ApplicationStatus } from '@/types';

export default function TrackerPage() {
  const user = useAuthStore((state) => state.user);
  const applications = useApplicationStore((state) => state.applications);
  const isHydrated = useApplicationStore((state) => state.isHydrated);
  const error = useApplicationStore((state) => state.error);
  const hydrate = useApplicationStore((state) => state.hydrate);
  const moveApplication = useApplicationStore((state) => state.moveApplication);
  const addApplication = useApplicationStore((state) => state.addApplication);

  // Manual Application Creation Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<{
    company: string;
    jobTitle: string;
    jobPostingUrl: string;
    status: ApplicationStatus;
    appliedDate: string;
    followUpDate: string;
    notes: string;
  }>({
    company: '',
    jobTitle: '',
    jobPostingUrl: '',
    status: 'saved',
    appliedDate: '',
    followUpDate: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.id && !isHydrated) void hydrate(user.id);
  }, [hydrate, isHydrated, user?.id]);

  const move = async (id: string, status: ApplicationStatus): Promise<void> => {
    try {
      await moveApplication(id, status);
      toast.success(`Application moved to ${status}.`);
    } catch (moveError: unknown) {
      toast.error(moveError instanceof Error ? moveError.message : 'The application could not be updated.');
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company.trim() || !form.jobTitle.trim()) {
      toast.error('Company name and job title are required.');
      return;
    }

    if (!user) {
      toast.error('You must be signed in to add an application.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addApplication({
        userId: user.id,
        company: form.company.trim(),
        jobTitle: form.jobTitle.trim(),
        jobPostingUrl: form.jobPostingUrl.trim() || undefined,
        status: form.status,
        applicationDate: form.appliedDate || new Date().toISOString(),
        followUpDate: form.followUpDate || undefined,
        notes: form.notes.trim() || undefined,
      });

      toast.success('Application added successfully.');
      setIsAddModalOpen(false);
      setForm({
        company: '',
        jobTitle: '',
        jobPostingUrl: '',
        status: 'saved',
        appliedDate: '',
        followUpDate: '',
        notes: '',
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#D93829]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-800 bg-stone-900 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-stone-400">
            <KanbanSquare className="h-3.5 w-3.5 text-stone-400" />
            Application pipeline
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-100 sm:text-4xl">Applications</h1>
          <p className="mt-1 text-sm text-stone-400">Track every saved role, interview, offer, and outcome.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add application
          </Button>
          <Link href="/dashboard/jobs">
            <Button
              variant="outline"
              className="rounded-lg border-stone-800 bg-stone-900 text-xs font-semibold text-stone-200 hover:bg-stone-800"
            >
              Find jobs
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-amber-900/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-300">
          {error}
        </p>
      )}

      {applications.length === 0 ? (
        <Card className="rounded-2xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="py-14">
            <EmptyState
              icon={<BriefcaseBusiness className="h-6 w-6 text-stone-500" />}
              title="No applications yet"
              description="Manually create an application or save a matched job to track your pipeline."
              action={
                <div className="flex gap-3">
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    className="rounded-lg bg-[#D93829] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create application
                  </Button>
                  <Link href="/dashboard/jobs">
                    <Button variant="outline" className="rounded-lg border-stone-700 bg-stone-850 px-4 text-xs text-stone-300">
                      Browse job matches
                    </Button>
                  </Link>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ApplicationKanban
          applications={applications}
          onMove={move}
          onNewApplication={() => setIsAddModalOpen(true)}
        />
      )}

      {/* Manual Application Creation Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-800 bg-[#28201E] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-display text-base font-bold text-stone-100">
                Add New Application
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded p-1 text-stone-400 hover:text-stone-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-300">
                    Company Name <span className="text-[#D93829]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.company}
                    onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                    placeholder="e.g. Stripe, Acme Corp"
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-[#D93829] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-300">
                    Job Title <span className="text-[#D93829]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.jobTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-[#D93829] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-300">
                    Initial Stage / Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ApplicationStatus }))}
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-[#D93829] focus:outline-none"
                  >
                    {KANBAN_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-300">
                    Job Posting URL
                  </label>
                  <input
                    type="url"
                    value={form.jobPostingUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, jobPostingUrl: e.target.value }))}
                    placeholder="https://company.com/jobs/123"
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 focus:border-[#D93829] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-300">
                    Date Applied
                  </label>
                  <input
                    type="date"
                    value={form.appliedDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, appliedDate: e.target.value }))}
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2 text-xs text-stone-100 focus:border-[#D93829] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-300">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, followUpDate: e.target.value }))}
                    className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2 text-xs text-stone-100 focus:border-[#D93829] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone-300">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Referral contacts, compensation expectations, interview notes..."
                  rows={3}
                  className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-xs text-stone-100 placeholder:text-stone-600 focus:border-[#D93829] focus:outline-none"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5 border-t border-stone-800/80 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg border border-stone-800 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D93829] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Application</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
