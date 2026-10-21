import { redirect } from 'next/navigation';

export default function InterviewHistoryRedirectPage(): never {
  redirect('/dashboard/interviews');
}
