import { SegmentedLoader } from '@/components/ui/SegmentedLoader';

export default function DashboardRouteLoading() {
  return <SegmentedLoader message="Building your Copilot..." subtitle="Calculating readiness from your verified evidence..." fullScreen />;
}
