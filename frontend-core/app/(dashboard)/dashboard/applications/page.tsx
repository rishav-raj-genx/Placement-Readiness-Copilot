import { redirect } from 'next/navigation';

export default function ApplicationsRedirectPage(): never {
  redirect('/dashboard/tracker');
}
