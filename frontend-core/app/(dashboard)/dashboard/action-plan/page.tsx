'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  FileText,
  GitBranch,
  FolderGit2,
  Linkedin,
  Code2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Smartphone,
  Target,
  Flame,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

interface ResumeReviewDetails {
  score?: number;
  page_count?: number;
  is_one_page?: boolean;
  is_ats_friendly?: boolean;
  uses_action_verbs?: boolean;
  has_spelling_or_grammar_issues?: boolean;
  has_coding_profile_links?: boolean;
  has_project_stack_and_impact?: boolean;
  has_clean_visual_layout?: boolean;
  has_quantifiable_metrics?: boolean;
  has_ats_keywords?: boolean;
  spelling_grammar_issues?: string[];
  specific_fixes?: string[];
}

interface GithubReviewDetails {
  score?: number;
  has_pinned_repos?: boolean;
  has_recent_commit_activity?: boolean;
  has_committed_secrets?: boolean;
  has_unit_tests?: boolean;
  has_ci_cd?: boolean;
  has_architecture_diagrams?: boolean;
  code_quality_score?: number;
  specific_fixes?: string[];
}

interface LinkedinReviewDetails {
  score?: number;
  has_complete_profile?: boolean;
  skills_relevant?: boolean;
  has_photo?: boolean;
  has_custom_url?: boolean;
  has_engagement_markers?: boolean;
  is_copy_paste_of_resume?: boolean;
  aligned_with_resume?: boolean;
  suggested_rewrites?: string[];
  specific_fixes?: string[];
}

interface LeetcodeReviewDetails {
  score?: number;
  username?: string;
  total_solved?: number;
  easy_solved?: number;
  medium_solved?: number;
  hard_solved?: number;
  contest_rating?: number;
  global_ranking?: number;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  specific_fixes?: string[];
}

interface RawReviewResult {
  resume_review?: ResumeReviewDetails;
  github_review?: GithubReviewDetails;
  linkedin_review?: LinkedinReviewDetails;
  leetcode_review?: LeetcodeReviewDetails;
  scores?: Record<string, number>;
  readiness_score?: number;
  total_readiness_score?: number;
  [key: string]: unknown;
}

interface LiveCheckItem {
  id: string;
  project_name: string;
  project_url: string;
  is_live: boolean;
  status_code: number;
  load_time_ms: number;
  mobile_friendly: boolean;
  has_complex_state?: boolean;
  quality_score: number;
  passed: boolean;
  console_errors: string[];
  page_errors: string[];
  recommendations: string[];
  screenshot_url?: string;
  content_evaluation?: {
    claims_matched?: boolean;
    matched_keywords?: string[];
    claimed_keywords_checked?: string[];
  };
}

interface ProjectProfileItem {
  id: string;
  name: string;
  repositoryUrl: string;
  liveUrl?: string;
  description: string;
}

export default function ActionPlanPage() {
  const user = useAuthStore((state) => state.user);
  const { review, readiness, analyze, isAnalyzing, profile } = useProfileStore();
  const [dbReviewData, setDbReviewData] = useState<RawReviewResult | null>(null);
  const [liveChecks, setLiveChecks] = useState<LiveCheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'resume' | 'github' | 'projects' | 'linkedin' | 'leetcode'>('all');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [verifyingProjectId, setVerifyingProjectId] = useState<string | null>(null);

  const fetchDetailedData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [reviewRes, checksRes] = await Promise.all([
        supabase
          .from('candidate_profile_reviews')
          .select('*')
          .eq('student_id', user.id)
          .maybeSingle(),
        supabase
          .from('project_live_checks')
          .select('*')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      if (reviewRes.data && reviewRes.data.result) {
        setDbReviewData(reviewRes.data.result as RawReviewResult);
      }
      if (checksRes.data) {
        setLiveChecks(checksRes.data as LiveCheckItem[]);
      }
    } catch {
      // Fallback to client store if direct query fails
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchDetailedData();
  }, [fetchDetailedData]);

  // Support direct URL hash navigation (#resume, #github, #leetcode, etc.)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      if (['resume', 'github', 'projects', 'linkedin', 'leetcode'].includes(hash)) {
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }
    }
  }, []);

  const activeResult: RawReviewResult | null = useMemo(() => {
    if (dbReviewData) return dbReviewData;
    if (review?.result) return review.result as unknown as RawReviewResult;
    return null;
  }, [dbReviewData, review]);

  const resume = activeResult?.resume_review;
  const github = activeResult?.github_review;
  const linkedin = activeResult?.linkedin_review;
  const leetcode = activeResult?.leetcode_review;
  const leetcodeScore = typeof leetcode?.score === 'number'
    ? leetcode.score
    : (activeResult?.scores?.leetcode ?? readiness?.breakdown?.leetcode?.rawScore ?? readiness?.breakdown?.coding_practice?.rawScore ?? 0);
  const leetcodeUrl = profile?.leetcodeUrl || profile?.codingProfileUrl || (leetcode?.username ? `https://leetcode.com/u/${leetcode.username}` : undefined);
  const canonicalLeetcodeUrl = useMemo(() => {
    const raw = profile?.leetcodeUrl || profile?.codingProfileUrl || leetcode?.username;
    if (!raw || !raw.trim()) return undefined;
    const clean = raw.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    const handle = clean.replace(/^@/, '').replace(/^(?:https?:\/\/)?(?:www\.)?leetcode\.(?:com|cn)\/(?:u\/)?/i, '');
    return `https://leetcode.com/u/${handle}`;
  }, [profile?.leetcodeUrl, profile?.codingProfileUrl, leetcode?.username]);

  const candidateProjects: ProjectProfileItem[] = useMemo(() => {
    if (profile?.projects && profile.projects.length > 0) {
      return profile.projects as ProjectProfileItem[];
    }
    return [];
  }, [profile?.projects]);

  const handleCopyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    toast.success('Snippet copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleReanalyze = async () => {
    if (!user?.id) {
      toast.error('Please sign in to re-evaluate your profile.');
      return;
    }
    toast.info('Re-evaluating profile against FAANG screening standards...');
    try {
      const ok = await analyze(user.id);
      if (ok) {
        const latestReview = useProfileStore.getState().review?.result;
        if (latestReview) {
          setDbReviewData(latestReview as unknown as RawReviewResult);
        }

        const reviewRecord = (latestReview || {}) as Record<string, unknown>;
        const githubErr = reviewRecord.github_error as string | undefined;
        const leetcodeErr = reviewRecord.leetcode_error as string | undefined;
        const ghRev = reviewRecord.github_review as { score?: number } | undefined;
        const lcRev = reviewRecord.leetcode_review as { score?: number } | undefined;

        const hasInvalidLinks =
          Boolean(githubErr) ||
          Boolean(leetcodeErr) ||
          (ghRev?.score === 0 && Boolean(profile?.githubUsername)) ||
          (lcRev?.score === 0 && Boolean(profile?.leetcodeUrl));

        if (hasInvalidLinks) {
          toast.warning('Profile evaluated, but some links were invalid. Please check your GitHub/LeetCode URLs.');
        } else {
          toast.success('Screening criteria re-evaluated!');
        }
        await fetchDetailedData();
      } else {
        const errorMsg = useProfileStore.getState().error;
        toast.error(errorMsg || 'Profile re-evaluation failed. Check the analysis service and try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Profile re-evaluation failed. Check the analysis service and try again.';
      toast.error(message);
    }
  };

  const handleReEvaluate = handleReanalyze;

  const handleTriggerLiveCheck = async (project: ProjectProfileItem) => {
    if (!project.liveUrl) {
      toast.error('Project does not have a live URL configured.');
      return;
    }
    setVerifyingProjectId(project.id);
    toast.info(`Auditing live URL for ${project.name}...`);
    try {
      const res = await fetch('/api/projects/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          liveUrl: project.liveUrl,
          projectName: project.name,
          description: project.description,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof data === 'object' && data !== null && 'error' in data
            ? String((data as Record<string, unknown>).error)
            : 'Live check failed'
        );
      }
      toast.success(`Live check complete for ${project.name}!`);
      void fetchDetailedData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Live link check failed.');
    } finally {
      setVerifyingProjectId(null);
    }
  };

  // Status Cap Detectors
  const resumeIsCappedAt60 = Boolean(resume && (resume.has_quantifiable_metrics === false || (resume.score ?? 0) <= 60 && resume.specific_fixes?.some(f => f.toLowerCase().includes('capped at 60'))));
  const githubIsCappedAt50 = Boolean(github && ((github.has_unit_tests === false || github.has_ci_cd === false || github.has_architecture_diagrams === false) || (github.score ?? 0) <= 50 && github.specific_fixes?.some(f => f.toLowerCase().includes('capped at 50'))));
  const linkedinIsCappedAt70 = Boolean(linkedin && ((linkedin.is_copy_paste_of_resume || linkedin.has_engagement_markers === false) || (linkedin.score ?? 0) <= 70 && linkedin.specific_fixes?.some(f => f.toLowerCase().includes('capped at 70'))));

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-24">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 border-b border-stone-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 transition hover:text-stone-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-stone-100 flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#D93829]/15 text-[#D93829]">
                <Target className="h-5 w-5" />
              </span>
              Placement Readiness Action Plan
            </h1>
            <Badge className="border-[#D93829]/40 bg-[#D93829]/15 text-[#D93829] text-[11px] font-semibold">
              FAANG &amp; SDE Screening Standards
            </Badge>
          </div>
          <p className="text-xs text-stone-400">
            Granular point deductions, pass/fail architectural audits, live-link performance benchmarks, and ready-to-paste rewrites.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => void handleReanalyze()}
            disabled={isAnalyzing || loading}
            variant="outline"
            className="border-stone-800 bg-stone-900 text-xs font-semibold text-stone-200 hover:border-[#D93829]/60 hover:bg-stone-800 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin text-[#D93829]' : ''}`} />
            {isAnalyzing ? 'Evaluating...' : 'Re-Evaluate Profile'}
          </Button>

        </div>
      </div>

      {/* Global Cap Warning if any caps are triggered */}
      {(resumeIsCappedAt60 || githubIsCappedAt50 || linkedinIsCappedAt70) && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 sm:p-5 text-rose-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-rose-100">
                Ruthless Screening Penalties Enforced
              </h3>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                Top-tier engineering recruiters penalize basic or unverified profiles. Address the mandatory caps below to unlock the 80+ elite tier:
              </p>
              <ul className="mt-2 list-inside list-disc text-xs space-y-1 text-rose-300">
                {resumeIsCappedAt60 && (
                  <li>
                    <strong className="text-rose-100">Resume Capped at 60/100:</strong> Bullets lack quantifiable engineering metrics (e.g., percentages, latencies, user throughput).
                  </li>
                )}
                {githubIsCappedAt50 && (
                  <li>
                    <strong className="text-rose-100">GitHub Capped at 50/100:</strong> Repositories lack automated Unit Tests, CI/CD pipelines, or README Architecture Diagrams.
                  </li>
                )}
                {linkedinIsCappedAt70 && (
                  <li>
                    <strong className="text-rose-100">LinkedIn Capped at 70/100:</strong> Profile is a copy-paste of resume without social proof / network engagement markers.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pillar Quick Navigation Bar */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-800 bg-stone-950/90 p-2 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'all'
              ? 'bg-[#D93829] text-white'
              : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <Zap className="h-3.5 w-3.5" /> All Pillars
        </button>

        <a
          href="#resume"
          onClick={() => setActiveTab('resume')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'resume'
              ? 'bg-[#D93829] text-white'
              : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Resume Diagnostics
          <span className="ml-1 rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold text-stone-300">
            {resume?.score ?? 0}/100
          </span>
        </a>

        <a
          href="#github"
          onClick={() => setActiveTab('github')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'github'
              ? 'bg-[#D93829] text-white'
              : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          GitHub &amp; Codebase
          <span className="ml-1 rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold text-stone-300">
            {github?.score ?? 0}/100
          </span>
        </a>

        <a
          href="#projects"
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'projects'
              ? 'bg-[#D93829] text-white'
              : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <FolderGit2 className="h-3.5 w-3.5" />
          Project &amp; Live Links
          <span className="ml-1 rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold text-stone-300">
            {candidateProjects.length} Projects
          </span>
        </a>

        <a
          href="#linkedin"
          onClick={() => setActiveTab('linkedin')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'linkedin'
              ? 'bg-[#D93829] text-white'
              : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <Linkedin className="h-3.5 w-3.5" />
          LinkedIn &amp; Network
          <span className="ml-1 rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold text-stone-300">
            {linkedin?.score ?? 0}/100
          </span>
        </a>

        <a
          href="#leetcode"
          onClick={() => setActiveTab('leetcode')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'leetcode'
              ? 'bg-[#D93829] text-white'
              : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          Coding Practice (LeetCode)
          <span className="ml-1 rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold text-stone-300">
            {Math.round(leetcodeScore)}/100
          </span>
        </a>
      </div>

      {loading && !activeResult ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-2 font-mono text-xs text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#D93829]" />
            Loading complete uncompressed review JSON...
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ============================================================== */}
          {/* SECTION 1: RESUME DIAGNOSTICS                                  */}
          {/* ============================================================== */}
          <section id="resume" className="scroll-mt-32 space-y-4">
            <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
              <CardHeader className="border-b border-stone-800/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-stone-800 bg-stone-900 text-[#D93829]">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-base font-bold text-stone-100">
                        Resume Diagnostics
                      </CardTitle>
                      <CardDescription className="text-xs text-stone-400">
                        ATS parsing compatibility, quantifiable outcome formulas, and structural validation.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {resumeIsCappedAt60 && (
                      <Badge className="border-rose-500/40 bg-rose-500/15 text-rose-400 text-xs font-bold">
                        CAPPED AT 60
                      </Badge>
                    )}
                    <span className="rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-1 font-mono text-sm font-bold text-[#D93829]">
                      {resume?.score ?? 0}/100
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* 1. Cap Notice if missing metrics */}
                {resumeIsCappedAt60 && (
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3.5 text-xs text-orange-200">
                    <strong className="font-semibold text-orange-100">Rule 1 Enforced: </strong>
                    Resume score is capped at 60/100 because bullet points lack quantifiable metrics. Top-tier recruiters reject vague statements like &quot;made it faster&quot;. Rewrite using the Google X-Y-Z formula: &quot;Accomplished [X] as measured by [Y] by doing [Z]&quot;.
                  </div>
                )}

                {/* 2. Granular Pass/Fail Checklist */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
                    Granular Pass / Fail Verification Checks
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DiagnosticItem
                      label="Quantifiable Metrics"
                      passed={Boolean(resume?.has_quantifiable_metrics)}
                      detail={resume?.has_quantifiable_metrics ? 'Percentages & numbers present' : 'Score capped at 60 (vague)'}
                      required
                    />
                    <DiagnosticItem
                      label="ATS Technical Keywords"
                      passed={Boolean(resume?.has_ats_keywords)}
                      detail={resume?.has_ats_keywords ? 'Core stack keywords matched' : 'Missing essential keywords (-15 pts)'}
                    />
                    <DiagnosticItem
                      label="Single-Page Length"
                      passed={Boolean(resume?.is_one_page)}
                      detail={resume?.is_one_page ? '1 page verified' : `${resume?.page_count || 2} pages (Cap at 75)`}
                    />
                    <DiagnosticItem
                      label="ATS-Safe Format"
                      passed={Boolean(resume?.is_ats_friendly)}
                      detail={resume?.is_ats_friendly ? 'Single column, clean headings' : 'Layout breaks ATS parser'}
                    />
                    <DiagnosticItem
                      label="Strong Action Verbs"
                      passed={Boolean(resume?.uses_action_verbs)}
                      detail={resume?.uses_action_verbs ? 'Impact verbs verified' : 'Passive phrasing used'}
                    />
                    <DiagnosticItem
                      label="Coding Profile Links"
                      passed={Boolean(resume?.has_coding_profile_links)}
                      detail={resume?.has_coding_profile_links ? 'GitHub/LeetCode found' : 'Missing profile links (-10 pts)'}
                    />
                    <DiagnosticItem
                      label="Project Stack & Impact"
                      passed={Boolean(resume?.has_project_stack_and_impact)}
                      detail={resume?.has_project_stack_and_impact ? 'Tech stack & metrics detailed' : 'Basic description (-10 pts)'}
                    />
                    <DiagnosticItem
                      label="Grammar & Spelling"
                      passed={!resume?.has_spelling_or_grammar_issues}
                      detail={resume?.has_spelling_or_grammar_issues ? `${resume.spelling_grammar_issues?.length || 1} typos flagged` : 'Clean technical copy'}
                    />
                  </div>
                </div>

                {/* 3. Granular Fixes and Point Deduction Details */}
                {resume?.specific_fixes && resume.specific_fixes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                      Specific Point Deductions &amp; Action Items
                    </h4>
                    <div className="space-y-2">
                      {resume.specific_fixes.map((fix, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300"
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D93829]/20 text-[10px] font-bold text-[#D93829]">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{fix}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Spelling / Grammar Fixes */}
                {resume?.spelling_grammar_issues && resume.spelling_grammar_issues.length > 0 && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                    <h5 className="text-xs font-bold text-rose-300 flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-4 w-4" /> Detected Typos &amp; Spelling Slips
                    </h5>
                    <ul className="list-inside list-disc text-xs text-rose-200/90 space-y-1">
                      {resume.spelling_grammar_issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ============================================================== */}
          {/* SECTION 2: GITHUB & CODEBASE AUDIT                             */}
          {/* ============================================================== */}
          <section id="github" className="scroll-mt-32 space-y-4">
            <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
              <CardHeader className="border-b border-stone-800/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-stone-800 bg-stone-900 text-[#D93829]">
                      <GitBranch className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-base font-bold text-stone-100">
                        GitHub &amp; Codebase Audit
                      </CardTitle>
                      <CardDescription className="text-xs text-stone-400">
                        Rigorous repository inspection: automated tests, CI/CD pipelines, and README architecture diagrams.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {githubIsCappedAt50 && (
                      <Badge className="border-rose-500/40 bg-rose-500/15 text-rose-400 text-xs font-bold">
                        CAPPED AT 50
                      </Badge>
                    )}
                    <span className="rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-1 font-mono text-sm font-bold text-[#D93829]">
                      {github?.score ?? 0}/100
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* Cap Notice if missing tests, CI/CD, or diagram */}
                {githubIsCappedAt50 && (
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3.5 text-xs text-orange-200">
                    <strong className="font-semibold text-orange-100">Rule 2 Enforced: </strong>
                    GitHub score is capped at 50/100 because repositories lack automated Unit Tests, CI/CD pipelines (GitHub Actions), or architecture diagrams in the README. A basic CRUD app with a default README is not enough for FAANG/SDE screening.
                  </div>
                )}

                {/* Granular Checks Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
                    Production Engineering Verification Checks
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DiagnosticItem
                      label="Automated Unit Tests"
                      passed={Boolean(github?.has_unit_tests)}
                      detail={github?.has_unit_tests ? 'Test suites detected' : 'Score capped at 50 (no tests)'}
                      required
                    />
                    <DiagnosticItem
                      label="CI/CD Workflows"
                      passed={Boolean(github?.has_ci_cd)}
                      detail={github?.has_ci_cd ? '.github/workflows active' : 'Score capped at 50 (no CI/CD)'}
                      required
                    />
                    <DiagnosticItem
                      label="README Architecture Diagram"
                      passed={Boolean(github?.has_architecture_diagrams)}
                      detail={github?.has_architecture_diagrams ? 'Mermaid/flowchart present' : 'Score capped at 50 (no diagram)'}
                      required
                    />
                    <DiagnosticItem
                      label="Pinned Flagship Repos"
                      passed={Boolean(github?.has_pinned_repos)}
                      detail={github?.has_pinned_repos ? 'Flagships pinned' : 'No pinned repos configured'}
                    />
                    <DiagnosticItem
                      label="Recent Commit Activity"
                      passed={Boolean(github?.has_recent_commit_activity)}
                      detail={github?.has_recent_commit_activity ? 'Active within 90 days' : 'Stale commit history'}
                    />
                    <DiagnosticItem
                      label="Security & Secret Hygiene"
                      passed={!github?.has_committed_secrets}
                      detail={github?.has_committed_secrets ? 'CRITICAL: Leaked keys detected' : 'Zero exposed secrets'}
                      required
                    />
                  </div>
                </div>

                {/* Concrete Fixes */}
                {github?.specific_fixes && github.specific_fixes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                      Remediation &amp; Code Quality Enhancements
                    </h4>
                    <div className="space-y-2">
                      {github.specific_fixes.map((fix, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300"
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D93829]/20 text-[10px] font-bold text-[#D93829]">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{fix}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ============================================================== */}
          {/* SECTION 3: PROJECT & LIVE LINK ANALYSIS                        */}
          {/* ============================================================== */}
          <section id="projects" className="scroll-mt-32 space-y-4">
            <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
              <CardHeader className="border-b border-stone-800/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-stone-800 bg-stone-900 text-[#D93829]">
                      <FolderGit2 className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-base font-bold text-stone-100">
                        Project &amp; Live Link Analysis
                      </CardTitle>
                      <CardDescription className="text-xs text-stone-400">
                        Headless browser verification: console error tracking, mobile responsiveness, and complex state management.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="border-stone-800 bg-stone-900 text-stone-300 text-xs">
                    {candidateProjects.length} Submitted Projects
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* Rule 3 Banner */}
                <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3.5 text-xs text-stone-300 leading-relaxed">
                  <strong className="text-stone-100">Rule 3 Enforced: </strong>
                  Heavy point deductions are applied if a live project produces browser console errors, fails mobile responsiveness (horizontal overflow), or is a static single page lacking complex interactive state management.
                </div>

                {/* Candidate Projects List with Live Audits */}
                {candidateProjects.length > 0 ? (
                  <div className="space-y-4">
                    {candidateProjects.map((project) => {
                      const matchedCheck = liveChecks.find(
                        (c) => c.project_url === project.liveUrl || c.project_name === project.name
                      );
                      const isVerifying = verifyingProjectId === project.id;

                      return (
                        <div
                          key={project.id}
                          className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-stone-100">{project.name}</h4>
                                {matchedCheck ? (
                                  matchedCheck.passed ? (
                                    <Badge className="border-orange-500/30 bg-orange-500/15 text-orange-400 text-[10px]">
                                      Verified &amp; Passing
                                    </Badge>
                                  ) : (
                                    <Badge className="border-red-500/40 bg-red-500/15 text-red-400 text-[10px]">
                                      Deductions Applied
                                    </Badge>
                                  )
                                ) : (
                                  <Badge className="border-stone-700 bg-stone-800 text-stone-400 text-[10px]">
                                    Not Verified Yet
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-stone-400 max-w-2xl leading-relaxed">
                                {project.description}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {project.liveUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleTriggerLiveCheck(project)}
                                  disabled={isVerifying}
                                  className="h-8 border-stone-700 bg-stone-800 text-xs text-stone-200 hover:border-[#D93829]/60 hover:bg-stone-700 gap-1.5"
                                >
                                  <RefreshCw className={`h-3 w-3 ${isVerifying ? 'animate-spin text-[#D93829]' : ''}`} />
                                  {isVerifying ? 'Checking...' : 'Run Live Check'}
                                </Button>
                              )}
                              {project.liveUrl && (
                                <a
                                  href={project.liveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="grid h-8 w-8 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Live Check Results for this Project */}
                          {matchedCheck && (
                            <div className="mt-3 space-y-3 rounded-lg border border-stone-800/80 bg-stone-950/70 p-3.5">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div>
                                  <span className="text-stone-500 block text-[10px] uppercase">Quality Score</span>
                                  <span className="font-mono font-bold text-stone-200">
                                    {matchedCheck.quality_score}/100
                                  </span>
                                </div>
                                <div>
                                  <span className="text-stone-500 block text-[10px] uppercase">Console Errors</span>
                                  <span className={`font-mono font-bold ${matchedCheck.console_errors?.length ? 'text-red-400' : 'text-orange-400'}`}>
                                    {matchedCheck.console_errors?.length || 0} errors
                                  </span>
                                </div>
                                <div>
                                  <span className="text-stone-500 block text-[10px] uppercase">Mobile Friendly</span>
                                  <span className={`font-mono font-bold ${matchedCheck.mobile_friendly ? 'text-orange-400' : 'text-red-400'}`}>
                                    {matchedCheck.mobile_friendly ? 'Pass (Responsive)' : 'Failed (Overflow)'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-stone-500 block text-[10px] uppercase">State Management</span>
                                  <span className={`font-mono font-bold ${matchedCheck.has_complex_state !== false ? 'text-orange-400' : 'text-stone-400'}`}>
                                    {matchedCheck.has_complex_state !== false ? 'Interactive State' : 'Static (Deducted)'}
                                  </span>
                                </div>
                              </div>

                              {matchedCheck.recommendations && matchedCheck.recommendations.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-stone-800/60">
                                  <span className="text-[11px] font-semibold text-stone-400 block">
                                    Recruiter Diagnostics &amp; Recommendations:
                                  </span>
                                  {matchedCheck.recommendations.map((rec, rIdx) => (
                                    <div key={rIdx} className="text-xs text-stone-300 flex items-start gap-2">
                                      <span className="text-[#D93829] font-bold">&bull;</span>
                                      <span>{rec}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-800 p-6 text-center text-xs text-stone-500">
                    No projects found on your profile. Add deployed projects with repositories and live links in your profile.
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ============================================================== */}
          {/* SECTION 4: LINKEDIN & NETWORK PROFILE                          */}
          {/* ============================================================== */}
          <section id="linkedin" className="scroll-mt-32 space-y-4">
            <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
              <CardHeader className="border-b border-stone-800/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-stone-800 bg-stone-900 text-[#D93829]">
                      <Linkedin className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-base font-bold text-stone-100">
                        LinkedIn &amp; Network Profile
                      </CardTitle>
                      <CardDescription className="text-xs text-stone-400">
                        Custom vanity URLs, keyword-rich headlines, social proof markers, and ready-to-paste rewrites.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {linkedinIsCappedAt70 && (
                      <Badge className="border-rose-500/40 bg-rose-500/15 text-rose-400 text-xs font-bold">
                        CAPPED AT 70
                      </Badge>
                    )}
                    <span className="rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-1 font-mono text-sm font-bold text-[#D93829]">
                      {linkedin?.score ?? 0}/100
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* Cap Notice if copy-paste */}
                {linkedinIsCappedAt70 && (
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3.5 text-xs text-orange-200">
                    <strong className="font-semibold text-orange-100">Rule 4 Enforced: </strong>
                    LinkedIn score is capped at 70/100 because the profile appears to be a copy-paste of your resume without network engagement markers (recommendations, articles, or community discussions).
                  </div>
                )}

                {/* Granular Checks Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
                    Network Profile Verification Checks
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DiagnosticItem
                      label="Custom Vanity URL"
                      passed={Boolean(linkedin?.has_custom_url)}
                      detail={linkedin?.has_custom_url ? 'Clean custom handle' : 'Default numeric URL (-15 pts)'}
                      required
                    />
                    <DiagnosticItem
                      label="Network Engagement"
                      passed={Boolean(linkedin?.has_engagement_markers)}
                      detail={linkedin?.has_engagement_markers ? 'Recommendations & activity' : 'Score capped at 70 (no proof)'}
                      required
                    />
                    <DiagnosticItem
                      label="Professional Photo"
                      passed={Boolean(linkedin?.has_photo)}
                      detail={linkedin?.has_photo ? 'Headshot detected' : 'No photo detected (-15 pts)'}
                    />
                    <DiagnosticItem
                      label="Keyword-Rich Headline"
                      passed={Boolean(linkedin?.has_complete_profile)}
                      detail={linkedin?.has_complete_profile ? 'Technical role keywords' : 'Generic student title'}
                    />
                    <DiagnosticItem
                      label="Resume Alignment"
                      passed={Boolean(linkedin?.aligned_with_resume)}
                      detail={linkedin?.aligned_with_resume ? 'Roles & skills aligned' : 'Role title discrepancies'}
                    />
                    <DiagnosticItem
                      label="Detailed Experience"
                      passed={Boolean(linkedin?.skills_relevant)}
                      detail={linkedin?.skills_relevant ? 'Accomplishments detailed' : 'Titles without depth'}
                    />
                  </div>
                </div>

                {/* Ready-to-Paste Rewrites Generated by AI */}
                {linkedin?.suggested_rewrites && linkedin.suggested_rewrites.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Ready-to-Paste AI Rewrites (Click to Copy)
                      </h4>
                      <span className="text-[11px] text-stone-500">1-click paste into LinkedIn</span>
                    </div>

                    <div className="space-y-3">
                      {linkedin.suggested_rewrites.map((rewrite, rIdx) => {
                        const copyKey = `rewrite-${rIdx}`;
                        const isCopied = copiedIndex === copyKey;

                        return (
                          <div
                            key={rIdx}
                            className="group relative rounded-xl border border-stone-800 bg-stone-900/70 p-4 transition hover:border-[#D93829]/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs leading-relaxed text-stone-200 font-mono select-all pr-8">
                                {rewrite}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyText(rewrite, copyKey)}
                                className="h-7 px-2.5 text-xs text-stone-400 hover:text-white hover:bg-stone-800 shrink-0 gap-1"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-orange-400" />
                                    <span className="text-orange-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Specific Action Fixes */}
                {linkedin?.specific_fixes && linkedin.specific_fixes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                      Specific Profile Improvements
                    </h4>
                    <div className="space-y-2">
                      {linkedin.specific_fixes.map((fix, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300"
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D93829]/20 text-[10px] font-bold text-[#D93829]">
                            {idx + 1}
                          </span>
                          <span className="flex-1">{fix}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ============================================================== */}
          {/* SECTION 5: CODING PRACTICE (LEETCODE)                          */}
          {/* ============================================================== */}
          <section id="leetcode" className="scroll-mt-32 space-y-4">
            <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
              <CardHeader className="border-b border-stone-800/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-stone-800 bg-stone-900 text-[#D93829]">
                      <Code2 className="h-5 w-5" />
                    </span>
                    <div>
                      <CardTitle className="text-base font-bold text-stone-100">
                        Coding Practice &amp; LeetCode Stats
                      </CardTitle>
                      <CardDescription className="text-xs text-stone-400">
                        GraphQL stats: Easy/Medium/Hard problem volume, difficulty ratio, and contest performance.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {leetcodeScore < 60 && (
                      <Badge className="border-orange-500/40 bg-orange-500/15 text-orange-400 text-xs font-bold">
                        NEEDS PRACTICE
                      </Badge>
                    )}
                    <span className="rounded-xl border border-stone-800 bg-stone-900/80 px-3 py-1 font-mono text-sm font-bold text-[#D93829]">
                      {Math.round(leetcodeScore)}/100
                    </span>
                    <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-400">
                      {Math.min(10, Math.round(leetcodeScore * 0.10 * 10) / 10)} / 10 pts
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-5">
                {/* 1. Stat Cards (Total Solved, Easy, Medium, Hard, Contest Rating) */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3.5 text-center">
                    <span className="text-[11px] uppercase tracking-wider text-stone-400">Total Solved</span>
                    <p className="mt-1 font-mono text-xl font-bold text-stone-100">
                      {leetcode?.total_solved ?? 0}
                    </p>
                    <span className="text-[10px] text-stone-500">Benchmark: 300+</span>
                  </div>

                  <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3.5 text-center">
                    <span className="text-[11px] uppercase tracking-wider text-amber-400">Easy</span>
                    <p className="mt-1 font-mono text-xl font-bold text-amber-400">
                      {leetcode?.easy_solved ?? 0}
                    </p>
                    <span className="text-[10px] text-stone-500">Fundamentals</span>
                  </div>

                  <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3.5 text-center">
                    <span className="text-[11px] uppercase tracking-wider text-orange-400">Medium</span>
                    <p className="mt-1 font-mono text-xl font-bold text-orange-400">
                      {leetcode?.medium_solved ?? 0}
                    </p>
                    <span className="text-[10px] text-stone-500">Target: 120+</span>
                  </div>

                  <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3.5 text-center">
                    <span className="text-[11px] uppercase tracking-wider text-rose-400">Hard</span>
                    <p className="mt-1 font-mono text-xl font-bold text-rose-400">
                      {leetcode?.hard_solved ?? 0}
                    </p>
                    <span className="text-[10px] text-stone-500">Target: 30+</span>
                  </div>

                  <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3.5 text-center">
                    <span className="text-[11px] uppercase tracking-wider text-stone-300">Contest Rating</span>
                    <p className="mt-1 font-mono text-xl font-bold text-stone-100">
                      {leetcode?.contest_rating ? Math.round(leetcode.contest_rating) : 'N/A'}
                    </p>
                    <span className="text-[10px] text-stone-500">
                      {leetcode?.global_ranking ? `Top #${leetcode.global_ranking.toLocaleString()}` : 'Unranked'}
                    </span>
                  </div>
                </div>

                {/* 2. Granular Diagnostic Verification Checks */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
                    FAANG / SDE Problem Solving Benchmarks
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DiagnosticItem
                      label="300+ Problems Solved"
                      passed={(leetcode?.total_solved ?? 0) >= 300}
                      detail={(leetcode?.total_solved ?? 0) >= 300 ? 'Volume benchmark cleared' : `${leetcode?.total_solved ?? 0}/300 problems (Volume deficit)`}
                      required
                    />
                    <DiagnosticItem
                      label="Medium / Hard Depth"
                      passed={((leetcode?.medium_solved ?? 0) + (leetcode?.hard_solved ?? 0)) >= 100}
                      detail={((leetcode?.medium_solved ?? 0) + (leetcode?.hard_solved ?? 0)) >= 100 ? 'Solid algorithmic depth' : 'Need more Medium/Hard practice'}
                      required
                    />
                    <DiagnosticItem
                      label="Contest Rating (1600+)"
                      passed={Boolean((leetcode?.contest_rating ?? 0) >= 1600)}
                      detail={(leetcode?.contest_rating ?? 0) >= 1600 ? `Rating: ${Math.round(leetcode!.contest_rating!)} (Competitive)` : 'Aim for 1600+ contest rating'}
                    />
                    <DiagnosticItem
                      label="Verified Profile Link"
                      passed={Boolean(canonicalLeetcodeUrl || leetcode?.username)}
                      detail={leetcode?.username ? `@${leetcode.username} verified` : (canonicalLeetcodeUrl ? 'Profile connected' : 'Connect LeetCode in Profile')}
                      required
                    />
                  </div>
                </div>

                {/* 3. Actionable Advice & Recruiter Diagnostics */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                    Targeted Action Plan &amp; Practice Recommendations
                  </h4>
                  <div className="space-y-2">
                    {(leetcode?.total_solved ?? 0) < 300 && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D93829]/20 text-[10px] font-bold text-[#D93829]">1</span>
                        <div className="flex-1">
                          <strong className="text-stone-100">Cross the 300+ problem threshold: </strong>
                          Your profile currently shows {leetcode?.total_solved ?? 0} solved problems. Aim for at least 300 problems to maximize recruiter confidence during campus and off-campus screenings.
                        </div>
                      </div>
                    )}

                    {(leetcode?.medium_solved ?? 0) < 120 && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D93829]/20 text-[10px] font-bold text-[#D93829]">2</span>
                        <div className="flex-1">
                          <strong className="text-stone-100">Solve more Mediums involving Graph traversal: </strong>
                          Focus practice on BFS/DFS traversal, Dijkstra, Topological Sort, and Tree DP. Top tech companies frequently draw Round 2 coding problems from Medium-difficulty graph paradigms.
                        </div>
                      </div>
                    )}

                    {(!leetcode?.contest_rating || leetcode.contest_rating < 1600) && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D93829]/20 text-[10px] font-bold text-[#D93829]">3</span>
                        <div className="flex-1">
                          <strong className="text-stone-100">Increase contest participation: </strong>
                          Join Biweekly and Weekly LeetCode Contests to build speed under time constraints and target a contest rating of 1600+ (Knight tier).
                        </div>
                      </div>
                    )}

                    {(leetcode?.hard_solved ?? 0) < 30 && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D93829]/20 text-[10px] font-bold text-[#D93829]">4</span>
                        <div className="flex-1">
                          <strong className="text-stone-100">Tackle advanced algorithmic patterns: </strong>
                          Attempt at least 30 Hard problems covering Monotonic Stack, Segment Trees, Trie, and Interval DP to differentiate yourself for senior/FAANG placement tiers.
                        </div>
                      </div>
                    )}

                    {leetcode?.improvements && leetcode.improvements.length > 0 && leetcode.improvements.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-xs leading-relaxed text-stone-300">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-400">&bull;</span>
                        <span className="flex-1">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer LeetCode Profile */}
                {canonicalLeetcodeUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-800/80 bg-stone-950/70 p-4">
                    <div className="text-xs text-stone-400">
                      External Coding Profile
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={canonicalLeetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-stone-300 hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View LeetCode Profile
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

        </div>
      )}
    </div>
  );
}

interface DiagnosticItemProps {
  label: string;
  passed: boolean;
  detail: string;
  required?: boolean;
}

function DiagnosticItem({ label, passed, detail, required }: DiagnosticItemProps) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        passed
          ? 'border-orange-500/20 bg-stone-900'
          : 'border-red-500/30 bg-red-950/10'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-200 truncate">{label}</span>
        {passed ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-500 bg-orange-500/10 p-1 rounded-full" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-red-500 bg-red-500/10 p-1 rounded-full" />
        )}
      </div>
      <p className={`mt-1.5 text-[11px] font-medium leading-tight ${passed ? 'text-stone-300' : 'text-red-300/90'}`}>
        {detail}
      </p>
    </div>
  );
}
