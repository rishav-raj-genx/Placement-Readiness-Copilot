'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BriefcaseBusiness, KanbanSquare, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ApplicationKanban } from '@/components/jobs/application-kanban';
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

  if (!isHydrated) {
    return <div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400"><KanbanSquare className="h-3.5 w-3.5" />APPLICATION PIPELINE</div>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Applications</h1>
          <p className="mt-1 text-sm text-white/60">Track every saved role, interview, offer, and outcome.</p>
        </div>
        <Link href="/dashboard/jobs"><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Find jobs</Button></Link>
      </div>

      {error && <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p>}

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-14">
            <EmptyState
              icon={<BriefcaseBusiness className="h-6 w-6 text-muted-foreground" />}
              title="No applications yet"
              description="Save or apply to a matched job and it will appear here."
              action={<Link href="/dashboard/jobs"><Button variant="brand">Browse job matches</Button></Link>}
            />
          </CardContent>
        </Card>
      ) : (
        <ApplicationKanban applications={applications} onMove={move} />
      )}
    </div>
  );
}
