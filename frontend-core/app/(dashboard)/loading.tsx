import { SegmentedLoader } from '@/components/ui/SegmentedLoader';

export default function DashboardLoading() {
  return <SegmentedLoader message="Building your Copilot..." subtitle="Parsing profile evidence and matching opportunities..." fullScreen />;
}
