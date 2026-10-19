'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  FileText,
  Users,
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
        title="Admin Dashboard"
        description="Manage job postings and monitor platform activity."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{jobs.length}</div>
              <div className="text-xs text-muted-foreground">Total Postings</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{publishedCount}</div>
              <div className="text-xs text-muted-foreground">Published</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50">
              <XCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{unpublishedCount}</div>
              <div className="text-xs text-muted-foreground">Unpublished</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Manage your platform</CardDescription>
            </div>
            <DemoLabel />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link
            href="/admin/jobs"
            className="flex items-center justify-between rounded-md border border-border p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Job Management</div>
                <div className="text-xs text-muted-foreground">Create, edit, publish, and delete job postings</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Postings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.slice(0, 5).map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-md border border-border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{job.title}</span>
                  <Badge
                    variant="secondary"
                    className={job.status === 'published' ? 'bg-success/10 text-success' : ''}
                  >
                    {job.status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{job.company}</span>
              </div>
              <Link href="/admin/jobs">
                <Button variant="ghost" size="sm">Manage</Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}
