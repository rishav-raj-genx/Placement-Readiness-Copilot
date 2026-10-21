import { describe, expect, it } from 'vitest';
import { parseConversationalIntent } from '@/lib/intake-intent';

describe('Conversational Intake Intent Parsing', () => {
  it('extracts GitHub URL and normalizes username', async () => {
    const input = 'Here is my github: https://github.com/rishav-raj-genx';
    const result = await parseConversationalIntent(input, {});
    expect(result.extracted.github).toBe('rishav-raj-genx');
    expect(result.reply).toBeDefined();
  });

  it('extracts LeetCode profile URL', async () => {
    const input = 'Check out my solutions: https://leetcode.com/u/rishav_coder';
    const result = await parseConversationalIntent(input, {});
    expect(result.extracted.leetcodeUrl).toBe('https://leetcode.com/u/rishav_coder');
  });

  it('extracts target role from natural language', async () => {
    const input = 'I am targeting Full Stack Developer roles';
    const result = await parseConversationalIntent(input, {});
    expect(result.extracted.targetRole).toBe('Full Stack Developer');
  });

  it('extracts LinkedIn profile URL', async () => {
    const input = 'Connect on https://linkedin.com/in/rishav-profile';
    const result = await parseConversationalIntent(input, {});
    expect(result.extracted.linkedinUrl).toBe('https://linkedin.com/in/rishav-profile');
  });
});
