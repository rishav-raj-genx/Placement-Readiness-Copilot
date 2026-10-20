import { NextResponse } from 'next/server';
import { getOptionalInterviewBaseUrl, serviceRequest } from '@/lib/backend-services';

export const runtime = 'nodejs';

const FALLBACK_CODING_PROBLEMS = [
  {
    id: 'two_sum',
    title: 'Two Sum Target Indices',
    category: 'DSA',
    difficulty: 'Easy',
    description:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution, and you may not use the same element twice.',
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', 'Only one valid answer exists.'],
    starter_code: {
      python: 'def two_sum(nums: list[int], target: int) -> list[int]:\n    # Write your solution here\n    pass\n',
      javascript: 'function twoSum(nums, target) {\n  // Write your solution here\n  return [];\n}\n',
      typescript: 'function twoSum(nums: number[], target: number): number[] {\n  // Write your solution here\n  return [];\n}\n',
    },
    test_cases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
      { input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
      { input: { nums: [3, 3], target: 6 }, expected: [0, 1] },
    ],
    optimal_time_complexity: 'O(N)',
    optimal_space_complexity: 'O(N)',
  },
  {
    id: 'lru_cache',
    title: 'LRU Cache Implementation',
    category: 'DSA',
    difficulty: 'Medium',
    description:
      'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement LRUCache with get(key) and put(key, value) in O(1) average time complexity.',
    constraints: ['1 <= capacity <= 3000', '0 <= key <= 10^4', '0 <= value <= 10^5'],
    starter_code: {
      python: 'class LRUCache:\n    def __init__(self, capacity: int):\n        self.capacity = capacity\n\n    def get(self, key: int) -> int:\n        return -1\n\n    def put(self, key: int, value: int) -> None:\n        pass\n',
      javascript: 'class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n  }\n  get(key) {\n    return -1;\n  }\n  put(key, value) {}\n}\n',
    },
    test_cases: [
      { operations: ['put(1, 1)', 'put(2, 2)', 'get(1)', 'put(3, 3)', 'get(2)'], expected: [null, null, 1, null, -1] },
    ],
    optimal_time_complexity: 'O(1) for both get and put',
    optimal_space_complexity: 'O(capacity)',
  },
  {
    id: 'use_debounce',
    title: 'Debounced Search & Function Hook',
    category: 'Web Development',
    difficulty: 'Medium',
    description:
      'Implement a debounced function utility `debounce(fn, delayMs)` that delays invoking `fn` until after `delayMs` milliseconds have elapsed since the last invocation. Provide a `.cancel()` method to clear pending timer executions.',
    constraints: ['Clear previous timeouts on consecutive calls.', 'Preserve `this` and argument forwarding.', 'Support .cancel() method.'],
    starter_code: {
      javascript: 'function debounce(fn, delayMs) {\n  function debounced(...args) {}\n  debounced.cancel = () => {};\n  return debounced;\n}\n',
      typescript: 'function debounce<T extends (...args: any[]) => any>(fn: T, delayMs: number): ((...args: Parameters<T>) => void) & { cancel: () => void } {\n  const debounced = (...args: Parameters<T>) => {};\n  debounced.cancel = () => {};\n  return debounced as any;\n}\n',
    },
    test_cases: [
      { input: { calls: 3, intervalMs: 50, delayMs: 150 }, expected: '1 final invocation' },
    ],
    optimal_time_complexity: 'O(1) execution overhead',
    optimal_space_complexity: 'O(1) closure state',
  },
  {
    id: 'fetch_with_retry',
    title: 'Resilient Fetch with Exponential Backoff',
    category: 'Web Development',
    difficulty: 'Medium',
    description:
      'Implement an asynchronous utility `fetchWithRetry(url, options, maxRetries, backoffMs)` that attempts an HTTP fetch request. If the request fails with a network error or 5xx status code, it retries up to `maxRetries` times with exponential backoff. 4xx client errors should not retry.',
    constraints: ['1 <= maxRetries <= 5', '100 <= backoffMs <= 5000', 'Do not retry on HTTP 400-499 errors.'],
    starter_code: {
      javascript: 'async function fetchWithRetry(url, options = {}, maxRetries = 3, backoffMs = 200) {\n  // Write your resilient fetch function here\n}\n',
      typescript: 'async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries: number = 3, backoffMs: number = 200): Promise<Response> {\n  throw new Error("Not implemented");\n}\n',
    },
    test_cases: [
      { scenario: 'Immediate 200 OK', expected: 'Succeeds attempt 1' },
      { scenario: '503 then 200', expected: 'Retries and succeeds on attempt 2' },
      { scenario: '404 Not Found', expected: 'Fails fast without retry' },
    ],
    optimal_time_complexity: 'O(1) execution logic',
    optimal_space_complexity: 'O(1)',
  },
];

export async function GET(): Promise<NextResponse> {
  const interviewBaseUrl = getOptionalInterviewBaseUrl();
  try {
    const data = await serviceRequest(`${interviewBaseUrl}/api/interview/coding-problems`, {
      method: 'GET',
      timeoutMs: 5000,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: 'ok', problems: FALLBACK_CODING_PROBLEMS });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  const interviewBaseUrl = getOptionalInterviewBaseUrl();

  try {
    const data = await serviceRequest(`${interviewBaseUrl}/api/interview/coding-evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: 15_000,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unavailable',
        error:
          'Coding evaluation service is temporarily unavailable. Please verify that the mock-interview backend service is running on port 8002.',
      },
      { status: 503 }
    );
  }
}

