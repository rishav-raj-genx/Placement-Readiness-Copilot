'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { ReviewTabs } from '@/components/review/review-tabs';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';

export default function ReviewPage() {
  const user = useAuthStore((state) => state.user);
  const { profile, review, isAnalyzing, analyze } = useProfileStore();
  return (
    <div className="space-y-6">
      <PageHeader title="Profile Review Engine" description="Evidence-level checks for your resume, GitHub, LinkedIn export, and project links." action={<Button variant="outline" disabled={isAnalyzing} onClick={() => user && void analyze(user.id)}>{isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Run review</Button>} />
      {review?.status === 'completed' && review.result ? <ReviewTabs review={review.result} projects={profile?.projects ?? []} /> : <div className="glass-panel grid min-h-64 place-items-center rounded-2xl p-8 text-center"><div>{isAnalyzing || review?.status === 'processing' ? <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-indigo-300" /> : null}<p className="font-medium">{review?.status === 'failed' ? 'The last analysis failed.' : 'Your review is not complete yet.'}</p><p className="mt-1 text-sm text-muted-foreground">Run the review to generate evidence-backed recommendations.</p></div></div>}
    </div>
  );
}
