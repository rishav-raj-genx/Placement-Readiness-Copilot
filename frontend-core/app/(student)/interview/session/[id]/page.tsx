import { redirect } from 'next/navigation';

interface LegacyInterviewSessionPageProps {
  params: { id: string };
}

export default function LegacyInterviewSessionPage({ params }: LegacyInterviewSessionPageProps): never {
  redirect(`/dashboard/interview/session/${params.id}`);
}
