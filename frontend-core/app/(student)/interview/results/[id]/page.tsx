import { redirect } from 'next/navigation';

interface LegacyInterviewResultsPageProps {
  params: { id: string };
}

export default function LegacyInterviewResultsPage({ params }: LegacyInterviewResultsPageProps): never {
  redirect(`/dashboard/interview/results/${params.id}`);
}
