'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { DemoLabel } from '@/components/shared/demo-label';
import { useJobStore } from '@/stores/job-store';

export default function AdminDashboardPage() {
  const { jobs, isHydrated, hydrate } = useJobStore();

  useEffect(() => {
    if (!isHydrated) void hydrate();
  }, [isHydrated, hydrate]);

  const publishedCount = jobs.filter((j) => j.status === 'published').length;
  const unpublishedCount = jobs.filter((j) => j.status === 'unpublished').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Admin dashboard"
        description="Manage job postings and monitor platform activity."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-stone-300">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-stone-100">{jobs.length}</div>
              <div className="text-xs text-stone-400">Total postings</div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-stone-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-stone-100">{publishedCount}</div>
              <div className="text-xs text-stone-400">Published</div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-stone-800 bg-[#28201E] shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-stone-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-stone-100">{unpublishedCount}</div>
              <div className="text-xs text-stone-400">Unpublished</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-stone-100">Quick actions</CardTitle>
              <CardDescription className="text-xs text-stone-400">Manage your platform postings</CardDescription>
            </div>
            <DemoLabel />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link
            href="/admin/jobs"
            className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900/60 p-4 transition-colors hover:border-stone-700 hover:bg-stone-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-800 text-stone-300">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-stone-200">Job management</div>
                <div className="text-xs text-stone-400">Create, edit, publish, and delete job postings</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-stone-400" />
          </Link>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-stone-800 bg-[#28201E] shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-100">Recent postings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.slice(0, 5).map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900/40 p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-stone-200">{job.title}</span>
                  <Badge
                    variant="secondary"
                    className={job.status === 'published' ? 'border-stone-700 bg-stone-800 text-stone-300' : 'border-stone-800 bg-stone-900 text-stone-500'}
                  >
                    {job.status}
                  </Badge>
                </div>
                <span className="text-xs text-stone-400">{job.company}</span>
              </div>
              <Link href="/admin/jobs">
                <Button variant="ghost" size="sm" className="text-xs text-stone-300 hover:bg-stone-800 hover:text-stone-100">
                  Manage
                </Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
