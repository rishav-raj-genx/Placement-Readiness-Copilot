import { redirect } from 'next/navigation';

export default function StudentInterviewRedirectPage(): never {
  redirect('/dashboard/interview');
}
