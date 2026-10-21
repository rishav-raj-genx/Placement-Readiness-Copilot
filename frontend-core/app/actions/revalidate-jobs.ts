'use server';

import { revalidatePath } from 'next/cache';

/**
 * Revalidates Next.js cached pages for the job discovery feed
 * so new admin MSOT postings appear immediately for all students.
 */
export async function revalidateJobsCache(): Promise<{ success: boolean }> {
  try {
    revalidatePath('/dashboard/jobs');
    revalidatePath('/jobs');
    return { success: true };
  } catch {
    return { success: false };
  }
}
