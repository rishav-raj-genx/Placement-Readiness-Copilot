import { redirect } from 'next/navigation';

export default function LegacyInterviewHistoryPage(): never {
  redirect('/dashboard/interviews');
}
