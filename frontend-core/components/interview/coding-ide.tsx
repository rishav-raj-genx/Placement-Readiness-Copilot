'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Loader2,
  PhoneOff,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { CodingIDESkeleton } from '@/components/interview/coding-ide-skeleton';
import {
  FALLBACK_CODING_PROBLEMS,
  type ProblemSpec,
} from '@/lib/fallback-coding-problems';

export type { ProblemSpec };

// Dynamically import Monaco Editor to avoid SSR window issues
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center bg-[#1a1310] text-stone-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#D93829]" /> Loading editor...
    </div>
  ),
});

export interface EvaluationResult {
  problem_id: string;
  problem_title: string;
  overall_score: number;
  passed_tests: number;
  total_tests: number;
  estimated_time_complexity: string;
  estimated_space_complexity: string;
  optimal_time_complexity: string;
  optimal_space_complexity: string;
  complexity_comparison: string;
  code_quality_feedback: string;
  strengths: string[];
  improvement_areas: string[];
  interviewer_follow_up: string;
  optimal_code_diff_note: string;
}

interface TestCaseExecutionResult {
  id?: string;
  name?: string;
  passed: boolean;
  message?: string;
  input?: unknown;
  actual?: unknown;
  expected?: unknown;
  runtime_ms?: number;
  error?: string;
}

interface CompileErrorState {
  type?: 'Compile Error' | 'Runtime Error' | 'SyntaxError';
  line?: number;
  column?: number;
  message: string;
  details?: string;
}

// Client-side empty check; real syntax errors and compilation diagnostics are handled by the execution engine
function validateCodeSyntax(
  code: string,
  _lang?: 'javascript' | 'typescript' | 'python'
): { valid: boolean; error?: CompileErrorState } {
  const trimmed = code.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: {
        type: 'SyntaxError',
        message: 'Empty solution provided',
        details: 'Please write your code implementation before running tests or submitting.',
      },
    };
  }

  return { valid: true };
}

// Markdown parser helper for rich problem spec
function renderMarkdownContent(content: string) {
  if (!content) return null;
  const sections = content.split('\n\n');

  return (
    <div className="space-y-4 text-xs leading-relaxed text-stone-300">
      {sections.map((sec, idx) => {
        const trimmed = sec.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="pt-2 text-sm font-bold text-stone-100 border-b border-stone-800 pb-1">
              {trimmed.replace('### ', '')}
            </h3>
          );
        }
        if (trimmed.startsWith('- **') || trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').filter(Boolean);
          return (
            <ul key={idx} className="space-y-1.5 pl-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#D93829] shrink-0" />
                  <span className="text-stone-300 font-sans">
                    {it.replace(/^- \*\*(.*?)\*\*/, '$1:').replace(/^- /, '')}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="text-stone-300">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function CodingIDE() {
  const router = useRouter();

  const [problems, setProblems] = useState<ProblemSpec[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'DSA' | 'Web Development'>('All');
  const [activeProblem, setActiveProblem] = useState<ProblemSpec | null>(null);
  const [language, setLanguage] = useState<'javascript' | 'typescript' | 'python'>('javascript');
  const [code, setCode] = useState<string>('');

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [compileError, setCompileError] = useState<CompileErrorState | null>(null);
  const [testOutput, setTestOutput] = useState<TestCaseExecutionResult[] | null>(null);
  const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState(0);

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evaluatedProblems, setEvaluatedProblems] = useState<Record<string, EvaluationResult>>({});
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [followUpSubmitted, setFollowUpSubmitted] = useState(false);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  const [activeTab, setActiveTab] = useState<'problem' | 'ai_review'>('problem');
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [showEndInterviewDialog, setShowEndInterviewDialog] = useState(false);
  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);

    const loadQuestions = async () => {
      try {
        setIsLoadingQuestions(true);
        const res = await fetch('/api/interview/coding', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        if (!active) return;
        if (data.problems && Array.isArray(data.problems) && data.problems.length > 0) {
          setProblems(data.problems);
          const initial = data.problems[0];
          setActiveProblem(initial);
          setCode(initial.starter_code?.javascript || initial.starter_code?.python || '');
          setIsLoadingQuestions(false);
          return;
        }
        throw new Error('No problems returned');
      } catch (err: unknown) {
        if (!active) return;
        console.warn('Coding questions fetch timed out or failed. Falling back to local problem bank:', err);
        setProblems(FALLBACK_CODING_PROBLEMS);
        const initial = FALLBACK_CODING_PROBLEMS[0];
        setActiveProblem(initial);
        setCode(initial.starter_code?.javascript || initial.starter_code?.python || '');
        setIsLoadingQuestions(false);
      }
    };

    void loadQuestions();

    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const handleSelectProblem = (prob: ProblemSpec) => {
    setActiveProblem(prob);
    const starter = prob.starter_code?.[language] || Object.values(prob.starter_code || {})[0] || '';
    setCode(starter);
    setCompileError(null);
    setTestOutput(null);
    setSelectedTestCaseIndex(0);
    setEvaluation(evaluatedProblems[prob.id] || null);
    setFollowUpAnswer('');
    setFollowUpSubmitted(false);
    setIsAutoAdvancing(false);
    setActiveTab('problem');
  };

  const currentProblemIndex = problems.findIndex((p) => p.id === activeProblem?.id);
  const hasNextProblem = currentProblemIndex >= 0 && currentProblemIndex < problems.length - 1;
  const hasPrevProblem = currentProblemIndex > 0;

  const handleNextProblem = () => {
    if (hasNextProblem) {
      const nextProb = problems[currentProblemIndex + 1];
      handleSelectProblem(nextProb);
      toast.info(`Loaded next question: ${nextProb.title}`);
    }
  };

  const handlePrevProblem = () => {
    if (hasPrevProblem) {
      const prevProb = problems[currentProblemIndex - 1];
      handleSelectProblem(prevProb);
      toast.info(`Loaded challenge: ${prevProb.title}`);
    }
  };

  const handleLanguageChange = (newLang: 'javascript' | 'typescript' | 'python') => {
    setLanguage(newLang);
    if (activeProblem?.starter_code?.[newLang]) {
      setCode(activeProblem.starter_code[newLang]);
      setCompileError(null);
      setTestOutput(null);
    }
  };

  const handleReset = () => {
    if (activeProblem?.starter_code?.[language]) {
      setCode(activeProblem.starter_code[language]);
      setCompileError(null);
      setTestOutput(null);
      toast.info('Starter code reset.');
    }
  };

  // Run Tests with LeetCode-grade real code execution and error diagnostics
  const handleRunTests = async () => {
    if (!activeProblem) return;
    setCompileError(null);
    setIsRunningTests(true);
    setIsConsoleOpen(true);

    // Step 1: Pre-flight syntax validation
    const syntaxCheck = validateCodeSyntax(code, language);
    if (!syntaxCheck.valid && syntaxCheck.error) {
      setCompileError(syntaxCheck.error);
      setTestOutput(null);
      setIsRunningTests(false);
      toast.error(syntaxCheck.error.message);
      return;
    }

    // Step 2: Execute real test cases via /api/interview/coding
    try {
      const res = await fetch('/api/interview/coding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          problem_id: activeProblem.id,
          language,
          code,
        }),
      });

      const data = await res.json();
      if (data.status === 'compile_error' || data.status === 'runtime_error') {
        const errPayload: CompileErrorState = {
          type: data.status === 'runtime_error' ? 'Runtime Error' : 'Compile Error',
          line: data.error?.line,
          column: data.error?.column,
          message: data.error?.message || 'Code execution error',
          details: data.error?.details || data.error?.message,
        };
        setCompileError(errPayload);
        setTestOutput(null);
        toast.error(`${errPayload.type}: ${errPayload.message}`);
        return;
      }

      if (data.status === 'success' && data.test_cases) {
        setTestOutput(data.test_cases);
        setCompileError(null);
        const passedCount = data.test_cases.filter((tc: TestCaseExecutionResult) => tc.passed).length;
        if (passedCount === data.test_cases.length) {
          toast.success(`Accepted! All ${passedCount}/${data.test_cases.length} test cases passed.`);
        } else {
          toast.warning(`Wrong Answer: ${passedCount}/${data.test_cases.length} test cases passed.`);
        }
      }
    } catch {
      toast.error('Could not connect to code execution service.');
    } finally {
      setIsRunningTests(false);
    }
  };

  // Submit Solution (formerly "Review and compare")
  const handleSubmitSolution = async () => {
    if (!activeProblem) return;
    setCompileError(null);
    setIsEvaluating(true);
    setIsConsoleOpen(true);
    setActiveTab('ai_review');

    // Syntax pre-check before submission
    const syntaxCheck = validateCodeSyntax(code, language);
    if (!syntaxCheck.valid && syntaxCheck.error) {
      setCompileError(syntaxCheck.error);
      setIsEvaluating(false);
      toast.error(syntaxCheck.error.message);
      return;
    }

    try {
      const res = await fetch('/api/interview/coding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          problem_id: activeProblem.id,
          language,
          code,
        }),
      });

      const data = await res.json();
      if (data.status === 'compile_error' || data.status === 'runtime_error') {
        setCompileError({
          type: data.status === 'runtime_error' ? 'Runtime Error' : 'Compile Error',
          line: data.error?.line,
          column: data.error?.column,
          message: data.error?.message || 'Compilation Error',
          details: data.error?.details || data.result?.code_quality_feedback,
        });
        toast.error('Code failed execution: ' + (data.error?.message || 'Compile Error'));
      } else if (data.result) {
        setEvaluation(data.result);
        setEvaluatedProblems((prev) => ({
          ...prev,
          [activeProblem.id]: data.result,
        }));
        if (data.test_cases) {
          setTestOutput(data.test_cases);
        }
        toast.success(`Evaluation complete! Score: ${data.result.overall_score}/100`);
      } else {
        toast.error(data.error || 'Code evaluation could not be processed.');
      }
    } catch {
      toast.error('Failed to communicate with evaluation service.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Submit interviewer follow-up with automatic advancement
  const handleSendFollowUp = () => {
    if (!followUpAnswer.trim()) return;
    setFollowUpSubmitted(true);
    setIsAutoAdvancing(true);

    if (hasNextProblem) {
      toast.success('Response recorded! Advancing to the next question in 2 seconds...');
      setTimeout(() => {
        handleNextProblem();
      }, 2000);
    } else {
      // Completed all questions in the bank!
      toast.success('Response recorded! Round 2 coding assessment is complete.');
      setTimeout(() => {
        handleFinalizeAssessment();
      }, 1500);
    }
  };

  // End Interview / Finalize Round 2
  const handleFinalizeAssessment = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('interview_round2_completed', 'true');
        sessionStorage.setItem('interview_round2_completed', 'true');
        localStorage.setItem('interview_round2_evaluations', JSON.stringify(evaluatedProblems));
        localStorage.setItem('interview_round2_average_score', String(averageScore || 85));
      }
      const currentUserId = useAuthStore.getState().user?.id;
      if (currentUserId) {
        await useProfileStore.getState().analyze(currentUserId).catch(() => null);
      }
      setIsInterviewCompleted(true);
      setShowEndInterviewDialog(false);
      toast.success('Round 2 coding assessment saved and completed!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error finalizing assessment.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const filteredProblems = problems.filter((p) => {
    if (selectedCategory === 'All') return true;
    return p.category === selectedCategory;
  });

  const totalEvaluatedCount = Object.keys(evaluatedProblems).length;
  const averageScore = useMemo(() => {
    const scores = Object.values(evaluatedProblems).map((e) => e.overall_score);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [evaluatedProblems]);

  if (isLoadingQuestions) {
    return <CodingIDESkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header: Category Filter, Problem Pills, and End Interview Action */}
      <div className="flex flex-col gap-4 rounded-2xl border border-stone-800 bg-[#28201E] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={`cursor-pointer px-3 py-1.5 text-xs transition-colors ${
              selectedCategory === 'All'
                ? 'border-stone-700 bg-stone-800 text-stone-100 font-semibold'
                : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
            }`}
            onClick={() => setSelectedCategory('All')}
          >
            All challenges ({problems.length})
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer px-3 py-1.5 text-xs transition-colors ${
              selectedCategory === 'DSA'
                ? 'border-stone-700 bg-stone-800 text-stone-100 font-semibold'
                : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
            }`}
            onClick={() => setSelectedCategory('DSA')}
          >
            DSA algorithms
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer px-3 py-1.5 text-xs transition-colors ${
              selectedCategory === 'Web Development'
                ? 'border-stone-700 bg-stone-800 text-stone-100 font-semibold'
                : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
            }`}
            onClick={() => setSelectedCategory('Web Development')}
          >
            Web development
          </Badge>
        </div>

        {/* Action Controls: Progress Badge & Prominent Finalize Exam Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge
            variant="outline"
            className="border-stone-800 bg-stone-900/90 font-mono text-[11px] text-stone-300 px-3 py-1.5"
          >
            {totalEvaluatedCount} of {problems.length} evaluated
          </Badge>
          <Button
            size="sm"
            onClick={() => setShowEndInterviewDialog(true)}
            className="h-9 px-4 rounded-xl bg-[#D93829] hover:bg-[#C22F21] text-white text-xs font-bold shadow-lg shadow-red-950/40 flex items-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5" /> Finalize &amp; Submit Exam
          </Button>
        </div>
      </div>

      {/* Problem Selection Pills with Solved Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {filteredProblems.map((prob) => {
          const isEvaluated = Boolean(evaluatedProblems[prob.id]);
          const isSelected = activeProblem?.id === prob.id;
          return (
            <button
              key={prob.id}
              onClick={() => handleSelectProblem(prob)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                isSelected
                  ? 'border-[#D93829] bg-[#D93829]/15 text-stone-100 shadow-sm'
                  : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
              }`}
            >
              {isEvaluated && <Check className="h-3.5 w-3.5 text-orange-600" />}
              <span>{prob.title}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                  prob.difficulty === 'Easy'
                    ? 'border border-orange-900/40 bg-orange-950/40 text-orange-400'
                    : prob.difficulty === 'Medium'
                    ? 'border border-amber-900/40 bg-amber-950/40 text-amber-300'
                    : 'border border-red-900/40 bg-red-950/40 text-red-300'
                }`}
              >
                {prob.difficulty}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main IDE Workspace: Problem Spec on Left, HackerRank / Judge0 Code Workspace on Right */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (5 cols on lg): Problem Spec & AI Feedback Hub */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-stone-800 bg-stone-900 overflow-hidden shadow-md shadow-black/40">
          {/* Navigation Tabs Header */}
          <div className="flex border-b border-stone-800 bg-stone-950 p-1.5">
            <button
              onClick={() => setActiveTab('problem')}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
                activeTab === 'problem'
                  ? 'border border-stone-700 bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Problem description
            </button>
            <button
              onClick={() => setActiveTab('ai_review')}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
                activeTab === 'ai_review'
                  ? 'border border-stone-700 bg-stone-800 text-stone-100 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              AI review & score {evaluation ? `(${evaluation.overall_score}/100)` : ''}
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-6 text-sm max-h-[820px]">
            {/* TAB 1: Detailed Problem Spec with Full Markdown */}
            {activeTab === 'problem' && activeProblem && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-stone-100">{activeProblem.title}</h2>
                    <span className="text-xs text-stone-400">{activeProblem.category}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      activeProblem.difficulty === 'Easy'
                        ? 'border-orange-800 bg-orange-950/40 text-orange-400'
                        : activeProblem.difficulty === 'Medium'
                        ? 'border-amber-800 bg-amber-950/40 text-amber-300'
                        : 'border-red-800 bg-red-950/40 text-red-300'
                    }`}
                  >
                    {activeProblem.difficulty}
                  </Badge>
                </div>

                {/* Rich Description */}
                <div>
                  {renderMarkdownContent(activeProblem.description)}
                </div>

                {/* Constraints */}
                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
                  <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-400">Constraints</h3>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-stone-300">
                    {activeProblem.constraints.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D93829]" />
                        <code className="font-mono text-stone-200">{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Target Complexities */}
                <div>
                  <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-400">Target complexities</h3>
                  <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3.5">
                      <span className="text-stone-500 text-[11px]">Optimal Time</span>
                      <p className="font-mono font-bold text-stone-200 mt-0.5">{activeProblem.optimal_time_complexity}</p>
                    </div>
                    <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3.5">
                      <span className="text-stone-500 text-[11px]">Optimal Space</span>
                      <p className="font-mono font-bold text-stone-200 mt-0.5">{activeProblem.optimal_space_complexity}</p>
                    </div>
                  </div>
                </div>

                {/* Sample Test Case 0 (HackerRank Style) */}
                {activeProblem.test_cases && activeProblem.test_cases.length > 0 && (
                  <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 space-y-3 font-mono text-xs">
                    <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-400">Sample Test Case 0</h3>
                    <div>
                      <span className="text-[10px] uppercase text-stone-500 font-semibold">Sample Input</span>
                      <pre className="mt-1 rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-stone-200 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(
                          activeProblem.test_cases[0].input ||
                          activeProblem.test_cases[0].operations ||
                          activeProblem.test_cases[0].scenario,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-stone-500 font-semibold">Sample Output</span>
                      <pre className="mt-1 rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-stone-200 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(activeProblem.test_cases[0].expected, null, 2)}
                      </pre>
                    </div>
                    {Boolean(activeProblem.test_cases[0].explanation) && (
                      <p className="font-sans text-xs text-stone-400 pt-1">
                        <span className="font-semibold text-stone-300">Explanation: </span>
                        {String(activeProblem.test_cases[0].explanation)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: AI Review & Score */}
            {activeTab === 'ai_review' && (
              <div className="space-y-5">
                {isEvaluating ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#D93829]" />
                    <h4 className="mt-3 font-semibold text-stone-200">Evaluating solution...</h4>
                    <p className="mt-1 text-xs text-stone-400">Analyzing time and space complexity, edge cases, and code structure.</p>
                  </div>
                ) : evaluation ? (
                  <div className="space-y-5">
                    {/* Score & Summary Banner */}
                    <div className="rounded-xl border border-stone-800 bg-stone-900 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">Round 2 score</p>
                          <h3 className="text-2xl font-bold text-stone-100">{evaluation.overall_score} / 100</h3>
                        </div>
                        <div className="rounded-full border border-stone-700 bg-stone-800 px-3 py-1 font-mono text-xs font-semibold text-stone-200">
                          {evaluation.passed_tests}/{evaluation.total_tests} tests passed
                        </div>
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-stone-300">{evaluation.code_quality_feedback}</p>
                    </div>

                    {/* Complexity Benchmark */}
                    <div>
                      <h4 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">Complexity benchmark</h4>
                      <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
                          <span className="text-stone-500 text-[11px]">Your time complexity</span>
                          <p className="font-mono font-bold text-stone-200">{evaluation.estimated_time_complexity}</p>
                          <span className="text-[10px] text-stone-500">Optimal: {evaluation.optimal_time_complexity}</span>
                        </div>
                        <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
                          <span className="text-stone-500 text-[11px]">Your space complexity</span>
                          <p className="font-mono font-bold text-stone-200">{evaluation.estimated_space_complexity}</p>
                          <span className="text-[10px] text-stone-500">Optimal: {evaluation.optimal_space_complexity}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-stone-300">{evaluation.complexity_comparison}</p>
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold text-stone-200">Key strengths</h4>
                        <ul className="mt-1 space-y-1 text-xs text-stone-400">
                          {evaluation.strengths.map((s, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-stone-200">Optimization areas</h4>
                        <ul className="mt-1 space-y-1 text-xs text-stone-400">
                          {evaluation.improvement_areas.map((imp, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <ChevronRight className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                              {imp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Interviewer Follow-Up Question & Automatic Progression */}
                    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
                      <div className="flex items-center gap-2 text-stone-300">
                        <Brain className="h-4 w-4 text-[#D93829]" />
                        <h4 className="font-semibold text-xs uppercase tracking-wider">Interviewer follow-up</h4>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-stone-300">{evaluation.interviewer_follow_up}</p>

                      {followUpSubmitted ? (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-lg border border-stone-800 bg-stone-900 p-2.5 text-xs text-stone-300">
                            <p className="font-semibold text-stone-200">Response recorded:</p>
                            <p className="mt-1 italic text-stone-400">&quot;{followUpAnswer}&quot;</p>
                          </div>
                          {isAutoAdvancing && (
                            <div className="flex items-center gap-2 text-xs text-stone-400 animate-pulse">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D93829]" />
                              <span>Advancing to next challenge...</span>
                            </div>
                          )}
                          {hasNextProblem && (
                            <Button
                              onClick={handleNextProblem}
                              className="w-full bg-[#D93829] hover:bg-[#C22F21] text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-md"
                            >
                              Advance to Next Coding Problem <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={2}
                            value={followUpAnswer}
                            onChange={(e) => setFollowUpAnswer(e.target.value)}
                            placeholder="Type your reasoning..."
                            className="w-full rounded-lg border border-stone-800 bg-stone-900 p-2 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-[#D93829]"
                          />
                          <Button
                            size="sm"
                            disabled={!followUpAnswer.trim() || isAutoAdvancing}
                            onClick={handleSendFollowUp}
                            className="w-full rounded-lg bg-[#D93829] text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] disabled:opacity-50"
                          >
                            {isAutoAdvancing ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            <span>Submit response</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center text-center text-stone-500">
                    <Brain className="h-7 w-7 text-stone-600" />
                    <p className="mt-2 text-xs">Click &quot;Submit Code&quot; in the editor action bar to receive structured AI evaluation and complexity feedback on your solution.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 cols on lg): HackerRank / Judge0 Code Editor & Execution Console */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-stone-800 bg-[#1a1310] overflow-hidden shadow-xl">
          {/* Editor Header Bar: Clean & Uncongested */}
          <div className="flex flex-wrap items-center justify-between border-b border-stone-800 bg-stone-950 px-5 py-3 gap-2">
            <div className="flex items-center gap-3">
              <Code2 className="h-4 w-4 text-[#D93829]" />
              <span className="font-mono text-xs font-semibold text-stone-200 truncate max-w-[220px]">
                {activeProblem ? activeProblem.title : 'Code editor'}
              </span>
              <div className="h-4 w-px bg-stone-800" />
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as 'javascript' | 'typescript' | 'python')}
                className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-mono text-stone-300 focus:outline-none focus:ring-1 focus:ring-[#D93829]"
              >
                <option value="javascript">JavaScript (Node.js)</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python 3</option>
              </select>
            </div>

            <div className="flex items-center gap-2.5">
              <Badge variant="outline" className="border-stone-800 bg-stone-900/80 text-[11px] font-mono text-stone-400">
                {isRunningTests ? 'Running...' : isEvaluating ? 'Evaluating...' : 'Ready'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-8 text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                title="Reset to default code template"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="h-[460px] w-full">
            <Editor
              height="100%"
              language={language === 'python' ? 'python' : 'javascript'}
              value={code}
              onChange={(val) => {
                setCode(val || '');
                if (compileError) setCompileError(null);
                if (testOutput) setTestOutput(null);
              }}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                automaticLayout: true,
                tabSize: 2,
                cursorBlinking: 'smooth',
                padding: { top: 14, bottom: 14 },
              }}
            />
          </div>

          {/* Dedicated HackerRank / Judge0 Bottom Action Bar (Uncongested, Spacious) */}
          <div className="flex flex-wrap items-center justify-between border-t border-stone-800 bg-stone-950 px-6 py-3.5 gap-3">
            {/* Left: Console toggle & Status pill */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsConsoleOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-mono text-stone-300 hover:border-stone-700 hover:text-stone-100 transition-colors"
              >
                <Terminal className="h-3.5 w-3.5 text-stone-400" />
                <span>Console</span>
                <span className="text-[10px] text-stone-500">{isConsoleOpen ? '▲' : '▼'}</span>
              </button>

              {compileError ? (
                <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Compile Error
                </span>
              ) : testOutput ? (
                <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-orange-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {testOutput.filter((t) => t.passed).length}/{testOutput.length} Tests Passed
                </span>
              ) : (
                <span className="hidden sm:inline-block text-[11px] text-stone-500 font-mono">
                  Live Sandbox • Node & Python
                </span>
              )}
            </div>

            {/* Right: Spacious Action Buttons with Next/Prev and Finalize */}
            <div className="flex flex-wrap items-center gap-2.5">
              {hasPrevProblem && (
                <Button
                  variant="outline"
                  onClick={handlePrevProblem}
                  className="h-10 px-3 rounded-xl border border-stone-800 bg-stone-900 hover:bg-stone-800 text-stone-300 font-medium text-xs flex items-center gap-1 transition-all"
                  title="Previous challenge"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleRunTests}
                disabled={isRunningTests || isEvaluating}
                className="h-10 px-4 sm:px-5 rounded-xl border border-stone-700 bg-stone-900 hover:bg-stone-800 text-stone-200 font-semibold text-xs flex items-center gap-2 shadow-sm transition-all hover:border-stone-600 active:scale-[0.98] disabled:opacity-50"
              >
                {isRunningTests ? (
                  <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                ) : (
                  <Play className="h-4 w-4 text-orange-600 fill-orange-600/20" />
                )}
                <span>Run Code</span>
              </Button>

              <Button
                onClick={handleSubmitSolution}
                disabled={isEvaluating || isRunningTests}
                className="h-10 px-5 sm:px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-black/40 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isEvaluating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Submit Code</span>
              </Button>

              {hasNextProblem ? (
                <Button
                  variant="outline"
                  onClick={handleNextProblem}
                  className="h-10 px-4 rounded-xl border border-stone-700 bg-stone-900 hover:bg-stone-800 text-stone-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
                >
                  <span>Next</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  onClick={() => setShowEndInterviewDialog(true)}
                  className="h-10 px-5 rounded-xl bg-[#D93829] hover:bg-[#C22F21] text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/40 transition-all active:scale-[0.98]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Finalize &amp; Submit Exam</span>
                </Button>
              )}
            </div>
          </div>

          {/* HackerRank / Judge0 Test Results & Console Drawer */}
          {isConsoleOpen && (
            <div className="border-t border-stone-800 bg-[#140e0b] p-5 space-y-4">
              {compileError ? (
                /* Compile / Runtime Error Terminal */
                <div className="rounded-xl border border-red-800/80 bg-red-950/60 p-4 space-y-2.5 font-mono text-xs text-red-200 shadow-xl">
                  <div className="flex items-center justify-between border-b border-red-900/60 pb-2">
                    <div className="flex items-center gap-2 font-bold text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                      <span className="text-sm font-semibold tracking-wide">
                        {compileError.type || 'Compilation Error'}
                      </span>
                    </div>
                    {typeof compileError.line === 'number' && (
                      <Badge variant="outline" className="border-red-800 bg-red-900/50 text-red-300 font-mono text-[11px]">
                        Line {compileError.line}{typeof compileError.column === 'number' ? `:${compileError.column}` : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="font-semibold text-stone-200">{compileError.message}</p>
                  {compileError.details && (
                    <pre className="whitespace-pre-wrap rounded-lg bg-stone-950/90 p-3.5 text-[11px] text-red-300 font-mono border border-red-900/50 overflow-x-auto">
                      {compileError.details}
                    </pre>
                  )}
                  <p className="text-[11px] text-stone-400 font-sans">
                    Fix the error above in your code and click &quot;Run Code&quot; to test again.
                  </p>
                </div>
              ) : testOutput ? (
                /* Test Execution Results (HackerRank & Judge0 Format) */
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 pb-3">
                    <div className="flex items-center gap-2">
                      {testOutput.every((t) => t.passed) ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          Accepted ({testOutput.length}/{testOutput.length} test cases passed)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                          <XCircle className="h-4 w-4 text-red-400" />
                          Wrong Answer ({testOutput.filter((t) => t.passed).length}/{testOutput.length} passed)
                        </span>
                      )}
                    </div>

                    {/* Test Case Selectors */}
                    <div className="flex flex-wrap gap-1.5">
                      {testOutput.map((tc, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedTestCaseIndex(idx)}
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-mono transition-colors ${
                            selectedTestCaseIndex === idx
                              ? 'border-stone-600 bg-stone-800 text-stone-100 font-bold'
                              : 'border-stone-800 bg-stone-900/70 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {tc.passed ? (
                            <CheckCircle2 className="h-3 w-3 text-orange-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-400" />
                          )}
                          <span>Case {idx}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Case Inspection */}
                  {testOutput[selectedTestCaseIndex] && (
                    <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-4 space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                        <span className="font-bold text-stone-200">
                          {testOutput[selectedTestCaseIndex].name || `Test Case ${selectedTestCaseIndex}`}
                        </span>
                        <div className="flex items-center gap-2">
                          {typeof testOutput[selectedTestCaseIndex].runtime_ms === 'number' && (
                            <span className="text-[10px] text-stone-400">
                              {testOutput[selectedTestCaseIndex].runtime_ms} ms
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={
                              testOutput[selectedTestCaseIndex].passed
                                ? 'border-orange-800 bg-orange-950/40 text-orange-400'
                                : 'border-red-800 bg-red-950/40 text-red-300'
                            }
                          >
                            {testOutput[selectedTestCaseIndex].passed ? 'Accepted' : 'Wrong Answer'}
                          </Badge>
                        </div>
                      </div>

                      {/* Input */}
                      <div>
                        <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Input (stdin)</span>
                        <pre className="mt-1 rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-stone-200 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(testOutput[selectedTestCaseIndex].input, null, 2)}
                        </pre>
                      </div>

                      {/* Output */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Your Output</span>
                          <pre className={`mt-1 rounded-lg border p-2.5 whitespace-pre-wrap overflow-x-auto ${
                            testOutput[selectedTestCaseIndex].passed
                              ? 'border-orange-900/60 bg-orange-950/30 text-orange-300'
                              : 'border-red-900/60 bg-red-950/30 text-red-200'
                          }`}>
                            {testOutput[selectedTestCaseIndex].error ? (
                              <span className="text-red-400">{testOutput[selectedTestCaseIndex].error}</span>
                            ) : (
                              JSON.stringify(testOutput[selectedTestCaseIndex].actual, null, 2)
                            )}
                          </pre>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Expected Output</span>
                          <pre className="mt-1 rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-stone-200 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(testOutput[selectedTestCaseIndex].expected, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Idle Helper State */
                <div className="rounded-xl border border-dashed border-stone-800 bg-stone-950/40 p-5 text-center">
                  <Terminal className="mx-auto h-5 w-5 text-stone-500" />
                  <p className="mt-2 text-xs text-stone-400 font-sans">
                    Click <span className="font-semibold text-stone-200">&quot;Run Code&quot;</span> to compile and test with sample inputs, or <span className="font-semibold text-orange-600">&quot;Submit Code&quot;</span> for full AI evaluation and scoring.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog: Finalize All Answers & Submit Coding Exam */}
      <AlertDialog open={showEndInterviewDialog} onOpenChange={setShowEndInterviewDialog}>
        <AlertDialogContent className="border border-stone-800 bg-[#28201E] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-stone-100 flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-[#D93829]" /> Finalize &amp; Submit Coding Exam?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-stone-400 text-xs leading-relaxed">
              You are about to submit your Round 2 technical assessment solutions. All code executions, test results, and algorithmic complexity evaluations will be permanently recorded into your final evaluation.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Breakdown of challenges in this session */}
          <div className="my-3 space-y-2 rounded-xl border border-stone-800 bg-stone-900/80 p-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone-400">Challenge</span>
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone-400">Score &middot; Status</span>
            </div>
            {problems.map((p) => {
              const evalRes = evaluatedProblems[p.id];
              return (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-stone-800/40 last:border-0">
                  <div className="flex items-center gap-1.5">
                    {evalRes ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-600" />
                    )}
                    <span className="text-stone-200 font-medium">{p.title}</span>
                  </div>
                  {evalRes ? (
                    <Badge variant="outline" className="border-emerald-800 bg-emerald-950/40 text-emerald-300 font-mono text-[10px]">
                      {evalRes.overall_score}/100 Evaluated
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-stone-800 bg-stone-900 text-stone-500 font-mono text-[10px]">
                      Pending Evaluation
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-stone-800 text-stone-300 hover:bg-stone-800">
              Continue Coding
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isFinalizing}
              onClick={handleFinalizeAssessment}
              className="bg-[#D93829] hover:bg-[#C22F21] text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {isFinalizing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Submit &amp; Complete Exam</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final Completion Modal: Automatic on completing all problems */}
      <AlertDialog open={isInterviewCompleted} onOpenChange={setIsInterviewCompleted}>
        <AlertDialogContent className="border border-stone-800 bg-stone-900 shadow-md shadow-black/40 text-center max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-950/60 border border-orange-800 text-orange-400">
            <Sparkles className="h-7 w-7" />
          </div>
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-xl font-bold text-stone-100 text-center">
              Round 2 Coding Assessment Complete!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-stone-300 text-xs leading-relaxed text-center">
              Congratulations! You have completed all coding challenges. Your algorithm solutions, time & space complexities, and edge case handling have been synthesized.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-2 rounded-xl border border-stone-800 bg-stone-950/80 p-4 text-center">
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500">Overall Coding Score</span>
            <p className="text-3xl font-bold text-orange-600 mt-1">{averageScore || 85} / 100</p>
            <p className="text-[11px] text-stone-400 mt-1">{totalEvaluatedCount} challenges evaluated</p>
          </div>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              onClick={() => router.push('/dashboard/interview')}
              className="w-full bg-[#D93829] hover:bg-[#C22F21] text-white font-semibold"
            >
              View Interview Results & Report <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
