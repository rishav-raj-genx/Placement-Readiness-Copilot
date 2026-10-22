export interface TestCaseSpec {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  operations?: string[];
  scenario?: string;
  expected: unknown;
  explanation?: string;
  [key: string]: unknown;
}

export interface ProblemSpec {
  id: string;
  title: string;
  category: 'DSA' | 'Web Development';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  constraints: string[];
  starter_code: Record<string, string>;
  test_cases: TestCaseSpec[];
  optimal_time_complexity: string;
  optimal_space_complexity: string;
}

export type CodingProblemSpec = ProblemSpec;

export const FALLBACK_CODING_PROBLEMS: ProblemSpec[] = [
  {
    id: 'two_sum',
    title: 'Two Sum Target Indices',
    category: 'DSA',
    difficulty: 'Easy',
    description: `### Problem Description

Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one valid solution**, and you **may not use the same element twice**. You can return the answer in any order.

### Engineering Context & Application
This problem is a quintessential test of hash-based lookup optimization. While a brute-force approach requires $O(N^2)$ comparisons using nested loops, senior production code leverages a hash map (or hash set) to achieve optimal $O(N)$ linear time complexity with $O(N)$ auxiliary space.

### Examples
- **Example 1:**
  - **Input:** \`nums = [2, 7, 11, 15], target = 9\`
  - **Output:** \`[0, 1]\`
  - **Explanation:** Because \`nums[0] + nums[1] == 2 + 7 == 9\`, we return \`[0, 1]\`.
- **Example 2:**
  - **Input:** \`nums = [3, 2, 4], target = 6\`
  - **Output:** \`[1, 2]\`
  - **Explanation:** Because \`nums[1] + nums[2] == 2 + 4 == 6\`, we return \`[1, 2]\`.
- **Example 3:**
  - **Input:** \`nums = [3, 3], target = 6\`
  - **Output:** \`[0, 1]\`
  - **Explanation:** Distinct indices \`0\` and \`1\` sum to \`6\`.`,
    constraints: [
      '2 <= nums.length <= 10^5',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists in the input array.',
    ],
    starter_code: {
      python: 'def two_sum(nums: list[int], target: int) -> list[int]:\n    # Write your optimal O(N) solution here\n    pass\n',
      javascript: '/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n  // Write your optimal O(N) solution here\n  \n}\n',
      typescript: 'function twoSum(nums: number[], target: number): number[] {\n  // Write your optimal O(N) solution here\n  \n}\n',
    },
    test_cases: [
      { id: 'tc1', name: 'Standard Case', input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1], explanation: '2 + 7 = 9 at indices 0 and 1.' },
      { id: 'tc2', name: 'Non-Adjacent Elements', input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2], explanation: '2 + 4 = 6 at indices 1 and 2.' },
      { id: 'tc3', name: 'Duplicate Values', input: { nums: [3, 3], target: 6 }, expected: [0, 1], explanation: '3 + 3 = 6 at indices 0 and 1.' },
      { id: 'tc4', name: 'Negative Values', input: { nums: [-1, -2, -3, -4, -5], target: -8 }, expected: [2, 4], explanation: '(-3) + (-5) = -8 at indices 2 and 4.' },
    ],
    optimal_time_complexity: 'O(N)',
    optimal_space_complexity: 'O(N)',
  },
  {
    id: 'lru_cache',
    title: 'LRU Cache Implementation',
    category: 'DSA',
    difficulty: 'Medium',
    description: `### Problem Description

Design a data structure that follows the constraints of a **Least Recently Used (LRU) Cache**.

Implement the \`LRUCache\` class:
- \`LRUCache(int capacity)\`: Initializes the LRU cache with positive size \`capacity\`.
- \`int get(int key)\`: Return the value of the \`key\` if the key exists, otherwise return \`-1\`.
- \`void put(int key, int value)\`: Update the value of the \`key\` if the \`key\` exists. Otherwise, add the \`key-value\` pair to the cache. If the number of keys exceeds \`capacity\` from this operation, **evict** the least recently used key.

The functions \`get\` and \`put\` must each run in **$O(1)$ average time complexity**.

### Engineering Context & Application
LRU caches form the foundational architecture of CDN edge caches (e.g. Cloudflare, Fastly), database buffer pools (PostgreSQL shared buffers), and operating system page tables. Achieving strict $O(1)$ eviction and lookup requires pairing a doubly linked list with a hash map.

### Examples
- **Example 1:**
  - **Operations:** \`["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]\`
  - **Inputs:** \`[[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]\`
  - **Output:** \`[null, null, null, 1, null, -1, null, -1, 3, 4]\`
  - **Explanation:** Key 2 is evicted when key 3 is added because key 1 was accessed by get(1).`,
    constraints: [
      '1 <= capacity <= 3000',
      '0 <= key <= 10^4',
      '0 <= value <= 10^5',
      'At most 2 * 10^5 calls will be made to get and put.',
    ],
    starter_code: {
      python: `class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity

    def get(self, key: int) -> int:
        return -1

    def put(self, key: int, value: int) -> None:
        pass
`,
      javascript: `class LRUCache {
  /**
   * @param {number} capacity
   */
  constructor(capacity) {
    this.capacity = capacity;
  }

  /**
   * @param {number} key
   * @return {number}
   */
  get(key) {
    return -1;
  }

  /**
   * @param {number} key
   * @param {number} value
   * @return {void}
   */
  put(key, value) {
    // Write your solution here
  }
}
`,
      typescript: `class LRUCache {
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: number): number {
    return -1;
  }

  put(key: number, value: number): void {
    // Write your solution here
  }
}
`,
    },
    test_cases: [
      { id: 'tc1', name: 'Capacity Eviction', operations: ['put(1, 1)', 'put(2, 2)', 'get(1)', 'put(3, 3)', 'get(2)'], expected: [null, null, 1, null, -1], explanation: 'Key 2 is evicted when key 3 is inserted because key 1 was recently accessed.' },
      { id: 'tc2', name: 'Update Existing Key', operations: ['put(2, 1)', 'put(2, 2)', 'get(2)'], expected: [null, null, 2], explanation: 'Updating key 2 overwrites its value and marks it most recently used.' },
      { id: 'tc3', name: 'Cache Miss Non-Existent', operations: ['get(5)', 'put(5, 50)', 'get(5)'], expected: [-1, null, 50], explanation: 'Accessing missing key returns -1.' },
    ],
    optimal_time_complexity: 'O(1) for both get and put',
    optimal_space_complexity: 'O(capacity)',
  },
  {
    id: 'use_debounce',
    title: 'Debounced Search & Function Hook',
    category: 'Web Development',
    difficulty: 'Medium',
    description: `### Problem Description

Implement a debounced function utility \`debounce(fn, delayMs)\` that delays invoking \`fn\` until after \`delayMs\` milliseconds have elapsed since the last time the debounced function was invoked.

The returned function must also expose a \`.cancel()\` method to immediately cancel any pending timer execution.

### Engineering Context & Application
Debouncing is an essential performance optimization in web user interfaces. Without debouncing, search auto-complete inputs flood backend servers with requests on every single keystroke. Debouncing batches high-frequency user events (keyboard typing, window resizing, scroll events) into a single controlled execution.

### Requirements
1. Delay execution of \`fn\` by \`delayMs\` milliseconds.
2. If called again before the delay has elapsed, reset the timer.
3. Forward arguments and maintain context (\`this\` binding) correctly.
4. Support a \`.cancel()\` method that clears active timers without executing \`fn\`.`,
    constraints: [
      '10 <= delayMs <= 5000',
      'Preserve argument forwarding to fn.',
      'Must support synchronous .cancel() method.',
    ],
    starter_code: {
      javascript: `/**
 * @param {Function} fn
 * @param {number} delayMs
 * @return {Function}
 */
function debounce(fn, delayMs) {
  function debounced(...args) {
    // Implement debounced execution
  }

  debounced.cancel = function () {
    // Implement timer cancellation
  };

  return debounced;
}
`,
      typescript: `function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  function debounced(...args: Parameters<T>) {
    // Implement debounced execution
  }

  debounced.cancel = function () {
    // Implement timer cancellation
  };

  return debounced as unknown as ((...args: Parameters<T>) => void) & { cancel: () => void };
}
`,
      python: `def debounce(fn, delay_sec):
    # Implement debounced callable with .cancel() method
    pass
`,
    },
    test_cases: [
      { id: 'tc1', name: 'Rapid Calls Coalescing', input: { calls: 3, intervalMs: 30, delayMs: 120 }, expected: '1 final invocation', explanation: 'Only the final call executes after the burst finishes.' },
      { id: 'tc2', name: 'Spaced Invocations', input: { calls: 2, intervalMs: 200, delayMs: 100 }, expected: '2 distinct invocations', explanation: 'Calls spaced beyond delay interval execute individually.' },
      { id: 'tc3', name: 'Timer Cancellation', input: { cancelAfterMs: 40, delayMs: 100 }, expected: '0 invocations (cancelled)', explanation: 'Explicit .cancel() prevents the pending timeout from firing.' },
    ],
    optimal_time_complexity: 'O(1) execution overhead',
    optimal_space_complexity: 'O(1) closure state',
  },
  {
    id: 'fetch_with_retry',
    title: 'Resilient Fetch with Exponential Backoff',
    category: 'Web Development',
    difficulty: 'Medium',
    description: `### Problem Description

Implement an asynchronous utility \`fetchWithRetry(url, options, maxRetries, backoffMs)\` that executes an HTTP fetch request with exponential backoff and jitter.

### Requirements
1. If the request succeeds (HTTP 2xx or 3xx), immediately return the \`Response\` object.
2. If the request fails due to a network error or a **5xx server error** (e.g. 500 Internal Server Error, 503 Service Unavailable), retry up to \`maxRetries\` times.
3. Apply exponential backoff between retries: $delay = backoffMs \\times 2^{attempt}$.
4. If the server returns a **4xx client error** (e.g. 400 Bad Request, 404 Not Found), do **not** retry. Fail fast and return or throw immediately.

### Engineering Context & Application
In microservice architectures, transient network hiccups and temporary load spikes cause sporadic 503 or dropped connections. A resilient client retries with exponential backoff to allow downstream services to recover gracefully without causing a stampede.`,
    constraints: [
      '1 <= maxRetries <= 5',
      '100 <= backoffMs <= 5000',
      'Fail immediately on 4xx client errors without retrying.',
    ],
    starter_code: {
      javascript: `/**
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [maxRetries=3]
 * @param {number} [backoffMs=200]
 * @return {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, backoffMs = 200) {
  // Implement resilient fetch with exponential backoff
  
}
`,
      typescript: `async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  backoffMs: number = 200
): Promise<Response> {
  // Implement resilient fetch with exponential backoff
  throw new Error("Not implemented");
}
`,
      python: `def fetch_with_retry(url, max_retries=3, backoff_sec=0.2):
    # Implement resilient HTTP request with exponential backoff
    pass
`,
    },
    test_cases: [
      { id: 'tc1', name: 'Immediate HTTP 200 OK', scenario: 'Immediate 200 OK response', expected: 'Succeeds on attempt 0 without delay' },
      { id: 'tc2', name: 'Transient 503 Retry', scenario: '503 Service Unavailable on attempt 0, then 200 on attempt 1', expected: 'Retries once with backoff delay and succeeds' },
      { id: 'tc3', name: 'Client 404 Fail-Fast', scenario: '404 Not Found response', expected: 'Fails immediately without retrying' },
    ],
    optimal_time_complexity: 'O(1) execution logic',
    optimal_space_complexity: 'O(1)',
  },
];
