import { SegmentedLoader } from '@/components/ui/SegmentedLoader';

export default function DashboardLoading() {
  return <SegmentedLoader message="Building your Copilot..." subtitle="Syncing Candidate Profile..." fullScreen />;
}
