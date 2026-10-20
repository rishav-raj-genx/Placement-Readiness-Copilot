import { redirect } from 'next/navigation';

export default function LegacyInterviewsPage(): never {
  redirect('/dashboard/interviews');
}
