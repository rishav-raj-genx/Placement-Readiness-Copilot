import { describe, expect, it } from 'vitest';

import { resolveInterviewFocusTopics } from '@/lib/interview-config';
import { filterRoles, OTHER_OPTION, STANDARD_ROLES } from '@/lib/roles';

describe('role combobox options and filtering', () => {
  it('provides key technical roles', () => {
    expect(STANDARD_ROLES).toContain('Frontend Developer');
    expect(STANDARD_ROLES).toContain('Backend Developer');
    expect(STANDARD_ROLES).toContain('Full Stack Engineer');
    expect(STANDARD_ROLES).toContain('DevOps & Cloud Engineer');
    expect(STANDARD_ROLES.length).toBeGreaterThanOrEqual(10);
  });

  it('filters standard roles accurately based on search query', () => {
    const results = filterRoles('front');
    expect(results).toEqual(['Frontend Developer']);
  });

  it('is case-insensitive and trims whitespace in queries', () => {
    const results = filterRoles('  BACKEND  ');
    expect(results).toEqual(['Backend Developer']);
  });

  it('returns all roles when query is empty or whitespace', () => {
    expect(filterRoles('')).toEqual([...STANDARD_ROLES]);
    expect(filterRoles('   ')).toEqual([...STANDARD_ROLES]);
  });

  it('has dedicated Other custom role constant', () => {
    expect(OTHER_OPTION).toBe('Other (Type custom role)');
  });

  it('uses a role-specific default when no focus topics are supplied', () => {
    expect(resolveInterviewFocusTopics('Frontend Developer', [])).toEqual([
      'General Frontend Developer Concepts',
    ]);
    expect(resolveInterviewFocusTopics('Frontend Developer', [' React ', ''])).toEqual(['React']);
  });
});
