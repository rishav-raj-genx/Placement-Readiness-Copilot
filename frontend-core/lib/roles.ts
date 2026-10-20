export const STANDARD_ROLES: readonly string[] = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Engineer',
  'Mobile Developer (iOS / Android)',
  'DevOps & Cloud Engineer',
  'Site Reliability Engineer (SRE)',
  'Data Scientist',
  'Machine Learning / AI Engineer',
  'Data Engineer',
  'Product Manager (Technical)',
  'UI/UX Designer & Engineer',
  'Cybersecurity Engineer',
  'QA & Automation Engineer',
  'Systems & Embedded Engineer',
] as const;

export const OTHER_OPTION = 'Other (Type custom role)';

export function filterRoles(query: string, roles: readonly string[] = STANDARD_ROLES): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...roles];
  return roles.filter((role) => role.toLowerCase().includes(q));
}
