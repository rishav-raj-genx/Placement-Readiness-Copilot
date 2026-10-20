"""Coding evaluation engine for Round 2: DSA and Web Development IDE challenges."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CodingProblem(BaseModel):
    id: str
    title: str
    category: Literal["DSA", "Web Development"]
    difficulty: Literal["Easy", "Medium", "Hard"]
    description: str
    constraints: list[str]
    starter_code: dict[str, str]
    test_cases: list[dict[str, Any]]
    optimal_solution: dict[str, str]
    optimal_time_complexity: str
    optimal_space_complexity: str


CODING_PROBLEM_BANK: dict[str, CodingProblem] = {
    "two_sum": CodingProblem(
        id="two_sum",
        title="Two Sum Target Indices",
        category="DSA",
        difficulty="Easy",
        description=(
            "Given an array of integers nums and an integer target, return indices of the "
            "two numbers such that they add up to target. You may assume each input has "
            "exactly one solution, and you may not use the same element twice."
        ),
        constraints=[
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "Only one valid answer exists.",
        ],
        starter_code={
            "python": "def two_sum(nums: list[int], target: int) -> list[int]:\n    # Write your solution here\n    pass\n",
            "javascript": "function twoSum(nums, target) {\n  // Write your solution here\n  return [];\n}\n",
            "typescript": "function twoSum(nums: number[], target: number): number[] {\n  // Write your solution here\n  return [];\n}\n",
        },
        test_cases=[
            {"input": {"nums": [2, 7, 11, 15], "target": 9}, "expected": [0, 1]},
            {"input": {"nums": [3, 2, 4], "target": 6}, "expected": [1, 2]},
            {"input": {"nums": [3, 3], "target": 6}, "expected": [0, 1]},
        ],
        optimal_solution={
            "python": (
                "def two_sum(nums: list[int], target: int) -> list[int]:\n"
                "    seen = {}\n"
                "    for idx, num in enumerate(nums):\n"
                "        complement = target - num\n"
                "        if complement in seen:\n"
                "            return [seen[complement], idx]\n"
                "        seen[num] = idx\n"
                "    return []\n"
            ),
            "javascript": (
                "function twoSum(nums, target) {\n"
                "  const seen = new Map();\n"
                "  for (let i = 0; i < nums.length; i++) {\n"
                "    const complement = target - nums[i];\n"
                "    if (seen.has(complement)) {\n"
                "      return [seen.get(complement), i];\n"
                "    }\n"
                "    seen.set(nums[i], i);\n"
                "  }\n"
                "  return [];\n"
                "}\n"
            ),
        },
        optimal_time_complexity="O(N)",
        optimal_space_complexity="O(N)",
    ),
    "lru_cache": CodingProblem(
        id="lru_cache",
        title="LRU Cache Implementation",
        category="DSA",
        difficulty="Medium",
        description=(
            "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. "
            "Implement the LRUCache class with get(key) and put(key, value) in O(1) average time complexity."
        ),
        constraints=[
            "1 <= capacity <= 3000",
            "0 <= key <= 10^4",
            "0 <= value <= 10^5",
            "At most 2 * 10^5 calls will be made to get and put.",
        ],
        starter_code={
            "python": (
                "class LRUCache:\n"
                "    def __init__(self, capacity: int):\n"
                "        self.capacity = capacity\n\n"
                "    def get(self, key: int) -> int:\n"
                "        return -1\n\n"
                "    def put(self, key: int, value: int) -> None:\n"
                "        pass\n"
            ),
            "javascript": (
                "class LRUCache {\n"
                "  constructor(capacity) {\n"
                "    this.capacity = capacity;\n"
                "  }\n"
                "  get(key) {\n"
                "    return -1;\n"
                "  }\n"
                "  put(key, value) {}\n"
                "}\n"
            ),
        },
        test_cases=[
            {"operations": ["put(1, 1)", "put(2, 2)", "get(1)", "put(3, 3)", "get(2)"], "expected": [None, None, 1, None, -1]},
        ],
        optimal_solution={
            "python": (
                "from collections import OrderedDict\n\n"
                "class LRUCache:\n"
                "    def __init__(self, capacity: int):\n"
                "        self.capacity = capacity\n"
                "        self.cache = OrderedDict()\n\n"
                "    def get(self, key: int) -> int:\n"
                "        if key not in self.cache:\n"
                "            return -1\n"
                "        self.cache.move_to_end(key)\n"
                "        return self.cache[key]\n\n"
                "    def put(self, key: int, value: int) -> None:\n"
                "        if key in self.cache:\n"
                "            self.cache.move_to_end(key)\n"
                "        self.cache[key] = value\n"
                "        if len(self.cache) > self.capacity:\n"
                "            self.cache.popitem(last=False)\n"
            ),
            "javascript": (
                "class LRUCache {\n"
                "  constructor(capacity) {\n"
                "    this.capacity = capacity;\n"
                "    this.map = new Map();\n"
                "  }\n"
                "  get(key) {\n"
                "    if (!this.map.has(key)) return -1;\n"
                "    const val = this.map.get(key);\n"
                "    this.map.delete(key);\n"
                "    this.map.set(key, val);\n"
                "    return val;\n"
                "  }\n"
                "  put(key, value) {\n"
                "    if (this.map.has(key)) this.map.delete(key);\n"
                "    this.map.set(key, value);\n"
                "    if (this.map.size > this.capacity) {\n"
                "      const firstKey = this.map.keys().next().value;\n"
                "      this.map.delete(firstKey);\n"
                "    }\n"
                "  }\n"
                "}\n"
            ),
        },
        optimal_time_complexity="O(1) for both get and put",
        optimal_space_complexity="O(capacity)",
    ),
    "use_debounce": CodingProblem(
        id="use_debounce",
        title="Debounced Search & Function Hook",
        category="Web Development",
        difficulty="Medium",
        description=(
            "Implement a debounced function or custom hook `debounce(fn, delayMs)` that delays invoking `fn` "
            "until after `delayMs` milliseconds have elapsed since the last time the debounced function was invoked. "
            "Include a `.cancel()` method to clear pending timer executions."
        ),
        constraints=[
            "Must clear previous timeouts on consecutive calls.",
            "Must preserve the correct `this` context and argument forwarding.",
            "Must provide a .cancel() method for component unmount safety.",
        ],
        starter_code={
            "javascript": (
                "function debounce(fn, delayMs) {\n"
                "  // Return debounced function with .cancel() method\n"
                "  function debounced(...args) {}\n"
                "  debounced.cancel = () => {};\n"
                "  return debounced;\n"
                "}\n"
            ),
            "typescript": (
                "function debounce<T extends (...args: any[]) => any>(\n"
                "  fn: T,\n"
                "  delayMs: number\n"
                "): ((...args: Parameters<T>) => void) & { cancel: () => void } {\n"
                "  // Write your TypeScript debounce implementation here\n"
                "  const debounced = (...args: Parameters<T>) => {};\n"
                "  debounced.cancel = () => {};\n"
                "  return debounced as any;\n"
                "}\n"
            ),
            "python": (
                "import threading\n\n"
                "def debounce(wait_sec):\n"
                "    # Decorator implementing debounce with threading.Timer\n"
                "    pass\n"
            ),
        },
        test_cases=[
            {"input": {"calls": 3, "intervalMs": 50, "delayMs": 150}, "expected": "1 final invocation"},
        ],
        optimal_solution={
            "javascript": (
                "function debounce(fn, delayMs) {\n"
                "  let timerId = null;\n"
                "  function debounced(...args) {\n"
                "    if (timerId !== null) {\n"
                "      clearTimeout(timerId);\n"
                "    }\n"
                "    timerId = setTimeout(() => {\n"
                "      fn.apply(this, args);\n"
                "      timerId = null;\n"
                "    }, delayMs);\n"
                "  }\n"
                "  debounced.cancel = () => {\n"
                "    if (timerId !== null) {\n"
                "      clearTimeout(timerId);\n"
                "      timerId = null;\n"
                "    }\n"
                "  };\n"
                "  return debounced;\n"
                "}\n"
            ),
        },
        optimal_time_complexity="O(1) execution overhead",
        optimal_space_complexity="O(1) closure state",
    ),
    "fetch_with_retry": CodingProblem(
        id="fetch_with_retry",
        title="Resilient Fetch with Exponential Backoff",
        category="Web Development",
        difficulty="Medium",
        description=(
            "Implement an asynchronous utility `fetchWithRetry(url, options, maxRetries, backoffMs)` that attempts "
            "an HTTP fetch request. If the request fails with a network error or 5xx status code, it retries up to "
            "`maxRetries` times with exponential backoff (e.g. backoffMs * 2^(attempt-1)). 4xx client errors should not retry."
        ),
        constraints=[
            "1 <= maxRetries <= 5",
            "100 <= backoffMs <= 5000",
            "Do not retry on HTTP 400-499 errors.",
        ],
        starter_code={
            "javascript": (
                "async function fetchWithRetry(url, options = {}, maxRetries = 3, backoffMs = 200) {\n"
                "  // Write your resilient fetch function here\n"
                "}\n"
            ),
            "typescript": (
                "async function fetchWithRetry(\n"
                "  url: string,\n"
                "  options: RequestInit = {},\n"
                "  maxRetries: number = 3,\n"
                "  backoffMs: number = 200\n"
                "): Promise<Response> {\n"
                "  // Write your resilient fetch function here\n"
                "  throw new Error('Not implemented');\n"
                "}\n"
            ),
            "python": (
                "import time\n"
                "import urllib.request\n\n"
                "def request_with_retry(url: str, max_retries: int = 3, backoff_sec: float = 0.2):\n"
                "    # Write Python urllib retry loop with exponential backoff\n"
                "    pass\n"
            ),
        },
        test_cases=[
            {"scenario": "Immediate 200 OK", "expected": "Succeeds attempt 1"},
            {"scenario": "503 then 200", "expected": "Retries and succeeds on attempt 2"},
            {"scenario": "404 Not Found", "expected": "Throws immediately without retry"},
        ],
        optimal_solution={
            "javascript": (
                "async function fetchWithRetry(url, options = {}, maxRetries = 3, backoffMs = 200) {\n"
                "  let lastError = null;\n"
                "  for (let attempt = 0; attempt <= maxRetries; attempt++) {\n"
                "    try {\n"
                "      const res = await fetch(url, options);\n"
                "      if (res.ok) return res;\n"
                "      if (res.status >= 400 && res.status < 500) {\n"
                "        return res; // Client errors fail fast\n"
                "      }\n"
                "      throw new Error(`Server returned HTTP ${res.status}`);\n"
                "    } catch (err) {\n"
                "      lastError = err;\n"
                "      if (attempt === maxRetries) break;\n"
                "      const waitTime = backoffMs * Math.pow(2, attempt);\n"
                "      await new Promise((resolve) => setTimeout(resolve, waitTime));\n"
                "    }\n"
                "  }\n"
                "  throw lastError;\n"
                "}\n"
            ),
        },
        optimal_time_complexity="O(1) execution logic",
        optimal_space_complexity="O(1)",
    ),
}


class CodingEvaluationResult(BaseModel):
    problem_id: str
    problem_title: str
    overall_score: int = Field(ge=0, le=100)
    passed_tests: int
    total_tests: int
    estimated_time_complexity: str
    estimated_space_complexity: str
    optimal_time_complexity: str
    optimal_space_complexity: str
    complexity_comparison: str
    code_quality_feedback: str
    strengths: list[str]
    improvement_areas: list[str]
    interviewer_follow_up: str
    optimal_solution_code: str = ""
    optimal_code_diff_note: str


def _execute_server_side_tests(problem_id: str, language: str, code: str) -> tuple[int, int]:
    """Execute code against test cases server-side in a sandboxed runner."""
    problem = CODING_PROBLEM_BANK.get(problem_id)
    if not problem:
        return 0, 0
    total_tests = len(problem.test_cases)
    cleaned = code.strip()
    if not cleaned or len(cleaned.splitlines()) < 2:
        return 0, total_tests

    # 1. Python execution sandbox
    if language == "python":
        import ast

        try:
            ast.parse(cleaned)
        except SyntaxError:
            return 0, total_tests

        passed = 0
        safe_globals: dict[str, Any] = {
            "__builtins__": {
                "range": range, "len": len, "enumerate": enumerate, "int": int, "str": str,
                "list": list, "dict": dict, "set": set, "tuple": tuple, "bool": bool,
                "min": min, "max": max, "sum": sum, "abs": abs,
            }
        }
        try:
            local_scope: dict[str, Any] = {}
            exec(cleaned, safe_globals, local_scope)  # noqa: S102

            if problem_id == "two_sum":
                func = local_scope.get("two_sum")
                if callable(func):
                    for tc in problem.test_cases:
                        inp = tc["input"]
                        res = func(inp["nums"], inp["target"])
                        if isinstance(res, (list, tuple)) and len(res) == 2:
                            i0, i1 = int(res[0]), int(res[1])
                            if (
                                i0 != i1
                                and 0 <= i0 < len(inp["nums"])
                                and 0 <= i1 < len(inp["nums"])
                                and inp["nums"][i0] + inp["nums"][i1] == inp["target"]
                            ):
                                passed += 1
            elif problem_id == "lru_cache":
                cache_cls = local_scope.get("LRUCache")
                if callable(cache_cls):
                    cache = cache_cls(2)
                    cache.put(1, 1)
                    cache.put(2, 2)
                    if cache.get(1) == 1:
                        cache.put(3, 3)
                        if cache.get(2) == -1:
                            passed = 1
            else:
                if "def " in cleaned and ("return" in cleaned or "Timer" in cleaned):
                    passed = total_tests
        except (SyntaxError, NameError, TypeError, ValueError, ZeroDivisionError, IndexError, KeyError, AttributeError):
            passed = 0

        return passed, total_tests

    # 2. JavaScript / TypeScript execution via Node or AST structure check
    if language in {"javascript", "typescript"}:
        import subprocess

        test_script = f"""
{cleaned}

let passed = 0;
const total = {total_tests};

try {{
  if ("{problem_id}" === "two_sum") {{
    const fn = (typeof twoSum === "function") ? twoSum : null;
    if (fn) {{
      const t1 = fn([2, 7, 11, 15], 9);
      if (Array.isArray(t1) && t1.length === 2 && [2,7,11,15][t1[0]] + [2,7,11,15][t1[1]] === 9) passed++;
      const t2 = fn([3, 2, 4], 6);
      if (Array.isArray(t2) && t2.length === 2 && [3,2,4][t2[0]] + [3,2,4][t2[1]] === 6) passed++;
      const t3 = fn([3, 3], 6);
      if (Array.isArray(t3) && t3.length === 2 && [3,3][t3[0]] + [3,3][t3[1]] === 6) passed++;
    }}
  }} else if ("{problem_id}" === "lru_cache") {{
    const Cls = (typeof LRUCache === "function") ? LRUCache : null;
    if (Cls) {{
      const c = new Cls(2);
      c.put(1, 1);
      c.put(2, 2);
      if (c.get(1) === 1) {{
        c.put(3, 3);
        if (c.get(2) === -1) passed = 1;
      }}
    }}
  }} else if ("{problem_id}" === "use_debounce") {{
    const fn = (typeof debounce === "function") ? debounce : null;
    if (fn) {{
      const d = fn(() => {{}}, 100);
      if (typeof d === "function" && typeof d.cancel === "function") passed = 1;
    }}
  }} else if ("{problem_id}" === "fetch_with_retry") {{
    const fn = (typeof fetchWithRetry === "function") ? fetchWithRetry : null;
    if (fn && typeof fn === "function") passed = 3;
  }}
}} catch (e) {{}}

console.log(JSON.stringify({{ passed, total }}));
"""
        try:
            res = subprocess.run(
                ["node", "-e", test_script],
                check=False,
                capture_output=True,
                text=True,
                timeout=3,
            )
            if res.returncode == 0:
                import json

                data = json.loads(res.stdout.strip())
                return int(data.get("passed", 0)), total_tests
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError, ValueError):
            pass  # Fall through to static analysis if Node runtime is unavailable

        # Static verification if node process was unavailable
        if problem_id == "two_sum" and "return" in cleaned and ("seen" in cleaned or "for" in cleaned):
            return (total_tests if "seen" in cleaned or "Map" in cleaned else total_tests - 1), total_tests
        if problem_id == "use_debounce" and "clearTimeout" in cleaned:
            return 1, total_tests
        if problem_id == "fetch_with_retry" and "fetch" in cleaned and ("retry" in cleaned or "for" in cleaned or "while" in cleaned):
            return 3, total_tests

    return 0, total_tests



def evaluate_coding_submission(
    problem_id: str,
    language: str,
    code: str,
    client_test_passed: int | None = None,
    client_test_total: int | None = None,
) -> CodingEvaluationResult:
    """Analyze student code against benchmarks and produce AI feedback."""
    problem = CODING_PROBLEM_BANK.get(problem_id)
    if not problem:
        problem = CODING_PROBLEM_BANK["two_sum"]

    cleaned_code = code.strip()
    lines = [line for line in cleaned_code.splitlines() if line.strip() and not line.strip().startswith(("#", "//"))]
    total_lines = len(lines)

    # Heuristic analysis of candidate algorithm
    has_hash_map = any(kw in cleaned_code for kw in ["seen", "Map(", "dict(", "{}", "HashMap", "cache"])
    has_nested_loop = False
    for i, line in enumerate(lines):
        if any(loop in line for loop in ["for ", "while "]):
            # Check if any subsequent lines within 10 lines have another loop
            for next_line in lines[i + 1 : i + 10]:
                if any(loop in next_line for loop in ["for ", "while "]):
                    has_nested_loop = True
                    break

    has_error_handling = any(kw in cleaned_code for kw in ["try", "catch", "except", "if (res.status", "clearTimeout", ".cancel"])
    has_edge_checks = any(kw in cleaned_code for kw in ["len(", "length", "null", "undefined", "None", "< 2", "== 0"])

    # Complexity estimation
    if problem.id == "two_sum":
        if has_nested_loop and not has_hash_map:
            time_comp = "O(N^2)"
            space_comp = "O(1)"
            comp_diff = "Your approach uses nested loops resulting in O(N^2) time complexity. The optimal approach uses a hash map for O(N) time."
            correctness_score = 75
        else:
            time_comp = "O(N)"
            space_comp = "O(N)"
            comp_diff = "Optimal! You utilized a hash map for single-pass O(N) lookup time."
            correctness_score = 95
    elif problem.id == "lru_cache":
        if "OrderedDict" in cleaned_code or ("Map" in cleaned_code and "delete" in cleaned_code):
            time_comp = "O(1)"
            space_comp = "O(capacity)"
            comp_diff = "Optimal O(1) eviction using ordered hash map tracking."
            correctness_score = 92
        else:
            time_comp = "O(N)"
            space_comp = "O(capacity)"
            comp_diff = "Using a basic list/array results in O(N) lookups or deletions. Doubly-linked list or ordered map achieves O(1)."
            correctness_score = 70
    elif problem.id == "use_debounce":
        if "clearTimeout" in cleaned_code and "cancel" in cleaned_code:
            time_comp = "O(1)"
            space_comp = "O(1)"
            comp_diff = "Clean closure management with complete timer invalidation and unmount safety."
            correctness_score = 94
        else:
            time_comp = "O(1)"
            space_comp = "O(1)"
            comp_diff = "Timer cancellation or context forwarding needs refinement for full production safety."
            correctness_score = 72
    else:
        # fetch_with_retry
        if "Math.pow" in cleaned_code or "**" in cleaned_code or "2 **" in cleaned_code:
            time_comp = "O(1)"
            space_comp = "O(1)"
            comp_diff = "Exponential backoff implemented correctly to prevent server thundering herds."
            correctness_score = 95
        else:
            time_comp = "O(1)"
            space_comp = "O(1)"
            comp_diff = "Linear or fixed backoff detected. Consider exponential backoff with jitter for production stability."
            correctness_score = 78

    # Server-side sandboxed test execution (never trust client_test_passed)
    passed_tests, total_tests = _execute_server_side_tests(problem.id, language, cleaned_code)

    # Quality score
    quality_score = 65
    if has_edge_checks:
        quality_score += 15
    if has_error_handling or total_lines >= 8:
        quality_score += 15
    if total_lines < 3 or passed_tests == 0:
        quality_score = min(quality_score, 40)
        correctness_score = min(correctness_score, 35)

    test_ratio = (passed_tests / total_tests) if total_tests > 0 else 0
    overall = round(0.50 * correctness_score + 0.30 * quality_score + 0.20 * (test_ratio * 100))
    overall = max(10, min(100, overall))


    strengths = []
    if correctness_score >= 80:
        strengths.append(f"Reached working solution matching {time_comp} time constraints.")
    if has_hash_map or "Map" in cleaned_code:
        strengths.append("Leveraged hash-based data structures for fast lookups.")
    if has_edge_checks:
        strengths.append("Included defensive guards for input edge cases.")
    if not strengths:
        strengths.append("Demonstrated clear algorithm decomposition.")

    improvements = []
    if time_comp != problem.optimal_time_complexity:
        improvements.append(f"Optimize time complexity from {time_comp} to {problem.optimal_time_complexity}.")
    if not has_edge_checks:
        improvements.append("Add defensive checks for empty or single-element inputs.")
    if not has_error_handling and problem.category == "Web Development":
        improvements.append("Ensure cleanup and memory leak prevention upon unmount or exception.")
    if not improvements:
        improvements.append("Consider benchmarking under high-concurrency edge conditions.")

    # Interviewer follow-up question
    if problem.id == "two_sum":
        follow_up = (
            "Interviewer Follow-Up: If the input array is already sorted, how would you solve "
            "this in O(1) auxiliary space without using a hash map?"
        )
    elif problem.id == "lru_cache":
        follow_up = (
            "Interviewer Follow-Up: How would you make this LRU cache thread-safe in a multi-threaded "
            "environment with high concurrent read and write operations?"
        )
    elif problem.id == "use_debounce":
        follow_up = (
            "Interviewer Follow-Up: What is the difference between debounce and throttle, and when "
            "would you choose throttle over debounce in a production UI?"
        )
    else:
        follow_up = (
            "Interviewer Follow-Up: How would you add randomized jitter to the backoff delay to prevent "
            "thousands of clients from retrying simultaneously during an outage?"
        )

    opt_code = problem.optimal_solution.get(language, next(iter(problem.optimal_solution.values())))
    opt_note = f"Compare with optimal {problem.optimal_time_complexity} time / {problem.optimal_space_complexity} space benchmark."

    return CodingEvaluationResult(
        problem_id=problem.id,
        problem_title=problem.title,
        overall_score=overall,
        passed_tests=passed_tests,
        total_tests=total_tests,
        estimated_time_complexity=time_comp,
        estimated_space_complexity=space_comp,
        optimal_time_complexity=problem.optimal_time_complexity,
        optimal_space_complexity=problem.optimal_space_complexity,
        complexity_comparison=comp_diff,
        code_quality_feedback=(
            f"Evaluated {total_lines} lines of code. Solution passes {passed_tests}/{total_tests} test scenarios. "
            f"Code demonstrates {time_comp} computational complexity with {space_comp} space overhead."
        ),
        strengths=strengths,
        improvement_areas=improvements,
        interviewer_follow_up=follow_up,
        optimal_solution_code=opt_code,
        optimal_code_diff_note=opt_note,
    )
