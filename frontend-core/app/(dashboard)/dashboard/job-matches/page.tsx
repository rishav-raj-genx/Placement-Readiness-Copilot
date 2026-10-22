import { redirect } from 'next/navigation';

export default function JobMatchesRedirectPage(): never {
  redirect('/dashboard/jobs');
}
