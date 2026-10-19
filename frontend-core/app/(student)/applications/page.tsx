import { redirect } from 'next/navigation';

export default function ApplicationsCompatibilityPage(): never {
  redirect('/jobs?tab=tracker');
}
