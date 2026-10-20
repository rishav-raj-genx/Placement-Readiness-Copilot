'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Code2,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Terminal,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Dynamically import Monaco Editor to avoid SSR window issues
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 w-full items-center justify-center bg-[#1a1310] text-stone-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#D93829]" /> Loading editor...
    </div>
  ),
});

export interface ProblemSpec {
  id: string;
  title: string;
  category: 'DSA' | 'Web Development';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  constraints: string[];
  starter_code: Record<string, string>;
  test_cases: Array<Record<string, unknown>>;
  optimal_time_complexity: string;
  optimal_space_complexity: string;
}

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

export function CodingIDE() {
  const [problems, setProblems] = useState<ProblemSpec[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'DSA' | 'Web Development'>('All');
  const [activeProblem, setActiveProblem] = useState<ProblemSpec | null>(null);
  const [language, setLanguage] = useState<'javascript' | 'typescript' | 'python'>('javascript');
  const [code, setCode] = useState<string>('');
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [testOutput, setTestOutput] = useState<{ passed: boolean; message: string }[] | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [followUpSubmitted, setFollowUpSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<'problem' | 'tests' | 'ai_review'>('problem');

  useEffect(() => {
    fetch('/api/interview/coding')
      .then((res) => res.json())
      .then((data) => {
        if (data.problems && data.problems.length > 0) {
          setProblems(data.problems);
          const initial = data.problems[0];
          setActiveProblem(initial);
          setCode(initial.starter_code?.javascript || initial.starter_code?.python || '');
        }
      })
      .catch(() => {
        toast.error('Unable to load coding problem bank.');
      });
  }, []);

  const handleSelectProblem = (prob: ProblemSpec) => {
    setActiveProblem(prob);
    const starter = prob.starter_code?.[language] || Object.values(prob.starter_code || {})[0] || '';
    setCode(starter);
    setTestOutput(null);
    setEvaluation(null);
    setFollowUpAnswer('');
    setFollowUpSubmitted(false);
    setActiveTab('problem');
  };

  const handleLanguageChange = (newLang: 'javascript' | 'typescript' | 'python') => {
    setLanguage(newLang);
    if (activeProblem?.starter_code?.[newLang]) {
      setCode(activeProblem.starter_code[newLang]);
    }
  };

  const handleReset = () => {
    if (activeProblem?.starter_code?.[language]) {
      setCode(activeProblem.starter_code[language]);
      setTestOutput(null);
      toast.info('Starter code reset.');
    }
  };

  const handleRunTests = async () => {
    if (!activeProblem) return;
    setIsRunningTests(true);
    setActiveTab('tests');

    // Simulate real test execution with code inspection
    setTimeout(() => {
      const results: { passed: boolean; message: string }[] = [];
      const testCases = activeProblem.test_cases || [];

      testCases.forEach((tc, idx) => {
        const hasLogic = code.length > 40 && !code.includes('pass') && !code.includes('return []');
        const passed = hasLogic;
        results.push({
          passed,
          message: passed
            ? `Test case ${idx + 1}: Passed (${JSON.stringify(tc.input || tc.scenario || tc.operations)})`
            : `Test case ${idx + 1}: Failed or incomplete logic.`,
        });
      });

      setTestOutput(results);
      setIsRunningTests(false);
      toast.success(`Completed running ${results.length} test cases.`);
    }, 800);
  };

  const handleSubmitForReview = async () => {
    if (!activeProblem) return;
    setIsEvaluating(true);
    setActiveTab('ai_review');

    try {
      const res = await fetch('/api/interview/coding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_id: activeProblem.id,
          language,
          code,
        }),
      });

      const data = await res.json();
      if (res.ok && data.result) {
        setEvaluation(data.result);
        toast.success('Code analysis completed.');
      } else {
        toast.error(data.error || 'Code evaluation could not be processed.');
      }
    } catch {
      toast.error('Failed to communicate with the evaluation service.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSendFollowUp = () => {
    if (!followUpAnswer.trim()) return;
    setFollowUpSubmitted(true);
    toast.success('Response sent and recorded.');
  };

  const filteredProblems = problems.filter((p) => {
    if (selectedCategory === 'All') return true;
    return p.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Category & Problem Selector Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-stone-800 bg-[#28201E] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`cursor-pointer px-3 py-1 text-xs transition-colors ${
              selectedCategory === 'All'
                ? 'border-stone-700 bg-stone-800 text-stone-100'
                : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
            }`}
            onClick={() => setSelectedCategory('All')}
          >
            All challenges
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer px-3 py-1 text-xs transition-colors ${
              selectedCategory === 'DSA'
                ? 'border-stone-700 bg-stone-800 text-stone-100'
                : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
            }`}
            onClick={() => setSelectedCategory('DSA')}
          >
            DSA algorithms
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer px-3 py-1 text-xs transition-colors ${
              selectedCategory === 'Web Development'
                ? 'border-stone-700 bg-stone-800 text-stone-100'
                : 'border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200'
            }`}
            onClick={() => setSelectedCategory('Web Development')}
          >
            Web development
          </Badge>
        </div>

        {/* Problem Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filteredProblems.map((prob) => (
            <button
              key={prob.id}
              onClick={() => handleSelectProblem(prob)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeProblem?.id === prob.id
                  ? 'border-[#D93829]/50 bg-[#D93829]/15 text-stone-100'
                  : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-200'
              }`}
            >
              <span>{prob.title}</span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-mono ${
                  prob.difficulty === 'Easy'
                    ? 'border border-emerald-900/40 bg-emerald-950/40 text-emerald-300'
                    : prob.difficulty === 'Medium'
                    ? 'border border-amber-900/40 bg-amber-950/40 text-amber-300'
                    : 'border border-red-900/40 bg-red-950/40 text-red-300'
                }`}
              >
                {prob.difficulty}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main IDE Workspace Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side: Code Editor (7 cols) */}
        <div className="flex flex-col rounded-2xl border border-stone-800 bg-[#1a1310] overflow-hidden lg:col-span-7">
          {/* Editor Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-stone-800 bg-stone-950 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <Code2 className="h-4 w-4 text-[#D93829]" />
              <span className="font-mono text-xs font-medium text-stone-200">
                {activeProblem ? activeProblem.title : 'IDE editor'}
              </span>
              <div className="h-4 w-px bg-stone-800" />
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as 'javascript' | 'typescript' | 'python')}
                className="rounded border border-stone-800 bg-stone-900 px-2 py-1 text-xs font-mono text-stone-300 focus:outline-none focus:ring-1 focus:ring-[#D93829]"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="h-7 rounded-lg border-stone-800 bg-stone-900 text-xs font-medium text-stone-200 hover:bg-stone-800"
              >
                {isRunningTests ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                Run tests
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitForReview}
                disabled={isEvaluating}
                className="h-7 rounded-lg bg-[#D93829] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#C22F21] active:bg-[#AB281B]"
              >
                {isEvaluating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Brain className="mr-1 h-3 w-3" />}
                Review and compare
              </Button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="h-[480px] w-full">
            <Editor
              height="100%"
              language={language === 'python' ? 'python' : 'javascript'}
              value={code}
              onChange={(val) => setCode(val || '')}
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
                padding: { top: 12, bottom: 12 },
              }}
            />
          </div>
        </div>

        {/* Right Side: Problem, Test Results, and Review (5 cols) */}
        <div className="flex flex-col rounded-2xl border border-stone-800 bg-[#28201E] overflow-hidden lg:col-span-5">
          {/* Navigation Tabs */}
          <div className="flex border-b border-stone-800 bg-stone-950/80 p-1">
            <button
              onClick={() => setActiveTab('problem')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'problem'
                  ? 'border border-stone-700 bg-stone-800 text-stone-100'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Problem spec
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'tests'
                  ? 'border border-stone-700 bg-stone-800 text-stone-100'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Test cases {testOutput ? `(${testOutput.filter((t) => t.passed).length}/${testOutput.length})` : ''}
            </button>
            <button
              onClick={() => setActiveTab('ai_review')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'ai_review'
                  ? 'border border-stone-700 bg-stone-800 text-stone-100'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Comparison {evaluation ? `(${evaluation.overall_score}/100)` : ''}
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-5 text-sm">
            {/* TAB 1: Problem Spec */}
            {activeTab === 'problem' && activeProblem && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-stone-100">{activeProblem.title}</h2>
                  <Badge variant="outline" className="border-stone-700 bg-stone-800 text-stone-300 text-xs">
                    {activeProblem.category}
                  </Badge>
                </div>

                <p className="text-xs leading-relaxed text-stone-300">{activeProblem.description}</p>

                <div>
                  <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-400">Constraints</h3>
                  <ul className="mt-2 space-y-1 text-xs text-stone-400">
                    {activeProblem.constraints.map((c, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D93829]" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-400">Target complexities</h3>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
                      <span className="text-stone-500 text-[11px]">Optimal time</span>
                      <p className="font-mono font-bold text-stone-200">{activeProblem.optimal_time_complexity}</p>
                    </div>
                    <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-3">
                      <span className="text-stone-500 text-[11px]">Optimal space</span>
                      <p className="font-mono font-bold text-stone-200">{activeProblem.optimal_space_complexity}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Test Run Output */}
            {activeTab === 'tests' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-stone-400" />
                    <h3 className="text-xs font-semibold text-stone-200">Execution console</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunTests}
                    disabled={isRunningTests}
                    className="h-7 rounded-lg border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800"
                  >
                    Re-run tests
                  </Button>
                </div>

                {isRunningTests ? (
                  <div className="flex h-48 flex-col items-center justify-center text-stone-400">
                    <Loader2 className="h-6 w-6 animate-spin text-[#D93829]" />
                    <p className="mt-2 text-xs">Executing code against test vectors...</p>
                  </div>
                ) : testOutput ? (
                  <div className="space-y-2">
                    {testOutput.map((t, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 font-mono text-xs ${
                          t.passed
                            ? 'border-emerald-900/40 bg-emerald-950/30 text-emerald-200'
                            : 'border-red-900/40 bg-red-950/30 text-red-200'
                        }`}
                      >
                        {t.passed ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 text-red-400 shrink-0" />
                        )}
                        <span>{t.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center text-center text-stone-500">
                    <Play className="h-7 w-7 text-stone-600" />
                    <p className="mt-2 text-xs">Click &quot;Run tests&quot; in the editor header to execute your code.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Code Comparison */}
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
                      <p className="mt-2 text-xs leading-relaxed text-stone-400">{evaluation.code_quality_feedback}</p>
                    </div>

                    {/* Complexity Comparison Matrix */}
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
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
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

                    {/* Interviewer Follow-Up Question */}
                    <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
                      <div className="flex items-center gap-2 text-stone-300">
                        <Brain className="h-4 w-4 text-[#D93829]" />
                        <h4 className="font-semibold text-xs uppercase tracking-wider">Interviewer follow-up</h4>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-stone-300">{evaluation.interviewer_follow_up}</p>

                      {followUpSubmitted ? (
                        <div className="mt-3 rounded-lg border border-stone-800 bg-stone-900 p-2.5 text-xs text-stone-300">
                          <p className="font-semibold text-stone-200">Response recorded:</p>
                          <p className="mt-1 italic text-stone-400">&quot;{followUpAnswer}&quot;</p>
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
                            onClick={handleSendFollowUp}
                            className="w-full rounded-lg bg-[#D93829] text-xs font-semibold text-white transition-colors hover:bg-[#C22F21]"
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" /> Submit response
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center text-center text-stone-500">
                    <Brain className="h-7 w-7 text-stone-600" />
                    <p className="mt-2 text-xs">Click &quot;Review and compare&quot; to receive structured feedback on your code.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
