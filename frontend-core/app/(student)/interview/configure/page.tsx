import { redirect } from 'next/navigation';

export default function LegacyConfigureInterviewPage(): never {
  redirect('/dashboard/interview');
}
