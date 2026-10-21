import { redirect } from 'next/navigation';

export default function ResultRedirectPage({
  params,
}: {
  params: { id: string };
}): never {
  redirect(`/dashboard/interview/results/${params.id}`);
}
