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
  Download,
  RefreshCw,
  FileText,
  Github,
  Linkedin,
  Code2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

interface RawReviewResult {
  resume_review?: {
    score?: number;
    page_count?: number;
    is_one_page?: boolean;
    is_ats_friendly?: boolean;
    uses_action_verbs?: boolean;
    has_spelling_or_grammar_issues?: boolean;
    spelling_grammar_issues?: string[];
    specific_fixes?: string[];
    has_github_link?: boolean;
    has_leetcode_link?: boolean;
    has_project_links?: boolean;
  };
  github_review?: {
    score?: number;
    specific_fixes?: string[];
    pinned_repos_count?: number;
    has_recent_commits?: boolean;
    has_committed_secrets?: boolean;
    secrets_found?: string[];
    code_quality_grade?: string;
  };
  linkedin_review?: {
    score?: number;
    has_complete_profile?: boolean;
    skills_relevant?: boolean;
    has_photo?: boolean;
    photo_detected?: boolean;
    suggested_rewrites?: string[];
    headline_critique?: string;
  };
  scores?: Record<string, number>;
  readiness_score?: number;
  total_readiness_score?: number;
  [key: string]: unknown;
}

export default function ReviewDetailsPage() {
  const user = useAuthStore((state) => state.user);
  const { review, readiness, analyze, isAnalyzing, hydrate } = useProfileStore();
  const [dbReviewData, setDbReviewData] = useState<RawReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedRewriteIndex, setCopiedRewriteIndex] = useState<number | null>(null);
  const [copiedRawJson, setCopiedRawJson] = useState(false);

  const fetchDetailedReview = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('candidate_profile_reviews')
        .select('*')
        .eq('student_id', user.id)
        .maybeSingle();

      if (data && data.result) {
        setDbReviewData(data.result as RawReviewResult);
      }
    } catch {
      // Ignore database read fallback
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchDetailedReview();
  }, [fetchDetailedReview]);

  const activeResult: RawReviewResult | null = useMemo(() => {
    if (dbReviewData) return dbReviewData;
    if (review?.result) return review.result as unknown as RawReviewResult;
    return null;
  }, [dbReviewData, review]);

  const resume = activeResult?.resume_review;
  const github = activeResult?.github_review;
  const linkedin = activeResult?.linkedin_review;

  const rawJsonFormatted = useMemo(() => {
    if (!activeResult) return '{\n  "status": "No profile review available. Please run an analysis from your profile."\n}';
    return JSON.stringify(activeResult, null, 2);
  }, [activeResult]);

  const handleCopyRewrite = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedRewriteIndex(index);
    toast.success('Rewrite snippet copied to clipboard');
    setTimeout(() => setCopiedRewriteIndex(null), 2000);
  };

  const handleCopyRawJson = () => {
    void navigator.clipboard.writeText(rawJsonFormatted);
    setCopiedRawJson(true);
    toast.success('Raw JSON output copied to clipboard');
    setTimeout(() => setCopiedRawJson(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([rawJsonFormatted], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profile-review-diagnostic-${user?.id || 'candidate'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded review diagnostic JSON');
  };

  const handleReanalyze = async () => {
    if (!user?.id) return;
    toast.info('Recalculating profile and readiness scores...');
    const ok = await analyze(user.id);
    if (ok) {
      toast.success('Profile analysis updated!');
      void fetchDetailedReview();
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800/80 pb-4">
        <div className="space-y-1">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-stone-100 flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-[#D93829]" />
            Detailed Profile Review &amp; Diagnostic
          </h1>
          <p className="text-xs text-stone-400">
            Granular pass/fail verification checks, ready-to-paste rewrites, and full raw JSON output from the AI analysis engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleReanalyze()}
            disabled={isAnalyzing || loading}
            variant="outline"
            className="border-stone-800 bg-stone-900 text-xs text-stone-200 hover:bg-stone-800 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin text-[#D93829]' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Re-run Analysis'}
          </Button>
        </div>
      </div>

      {loading && !activeResult ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex items-center gap-2 font-mono text-xs text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin text-[#D93829]" />
            Loading granular review diagnostics...
          </div>
        </div>
      ) : (
        <>
          {/* SECTION 1: RESUME AUDIT */}
          <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
            <CardHeader className="border-b border-stone-800/80 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-[#D93829]">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-bold text-stone-100">Resume Granular Audit</CardTitle>
                    <CardDescription className="text-xs text-stone-400">
                      ATS structure, page budget, action verbs, and spelling/grammar evaluation
                    </CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-bold text-stone-100">
                    {resume?.score ?? 0}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono"> / 100</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Pass / Fail Badges Grid */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">ATS Formatting</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {resume?.is_ats_friendly ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pass (Clean ATS)
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Fail (Formatting Issues)
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Page Count Budget</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {resume?.is_one_page ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pass ({resume.page_count || 1} page)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Over budget ({resume?.page_count || 2}+ pages)
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Action Verbs</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {resume?.uses_action_verbs ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pass (Strong Verbs)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Passive Language
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Grammar &amp; Spelling</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {!resume?.has_spelling_or_grammar_issues ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Clean (0 errors)
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Issues Detected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Spelling & Grammar Issues List */}
              {Boolean(resume?.spelling_grammar_issues?.length) && (
                <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 space-y-2">
                  <div className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                    Identified Grammar &amp; Spelling Flaws:
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-stone-300">
                    {resume?.spelling_grammar_issues?.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specific Fixes */}
              {Boolean(resume?.specific_fixes?.length) && (
                <div className="space-y-2 pt-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Actionable Resume Improvements
                  </span>
                  <div className="grid gap-2">
                    {resume?.specific_fixes?.map((fix, i) => (
                      <div key={i} className="rounded-lg border border-stone-800 bg-stone-900/40 p-3 text-xs text-stone-300 flex items-start gap-2">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-stone-800 font-mono text-[10px] font-bold text-stone-400">
                          {i + 1}
                        </span>
                        <span>{fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 2: GITHUB AUDIT */}
          <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
            <CardHeader className="border-b border-stone-800/80 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-200">
                    <Github className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-bold text-stone-100">GitHub &amp; Codebase Security Audit</CardTitle>
                    <CardDescription className="text-xs text-stone-400">
                      Secret leaks scan, repository health, pinned projects, and commit frequency
                    </CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-bold text-stone-100">
                    {github?.score ?? 0}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono"> / 100</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Committed Secrets Scan</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {github?.has_committed_secrets ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5 text-red-400" /> Leaked Keys Detected!
                      </span>
                    ) : (
                      <span className="text-orange-400 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-orange-400" /> Pass (Zero Leaks)
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Pinned Repositories</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {(github?.pinned_repos_count ?? 0) >= 2 ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pass ({github?.pinned_repos_count} pinned)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Need 2+ pinned repos
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Commit Frequency</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {github?.has_recent_commits ?? true ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active Recent Commits
                      </span>
                    ) : (
                      <span className="text-stone-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Stale Repository Activity
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {Boolean(github?.specific_fixes?.length) && (
                <div className="space-y-2 pt-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    GitHub Recommendations
                  </span>
                  <div className="grid gap-2">
                    {github?.specific_fixes?.map((fix, i) => (
                      <div key={i} className="rounded-lg border border-stone-800 bg-stone-900/40 p-3 text-xs text-stone-300 flex items-start gap-2">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-stone-800 font-mono text-[10px] font-bold text-stone-400">
                          {i + 1}
                        </span>
                        <span>{fix}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 3: LINKEDIN & READY-TO-PASTE REWRITES */}
          <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
            <CardHeader className="border-b border-stone-800/80 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-orange-400">
                    <Linkedin className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-bold text-stone-100">LinkedIn &amp; Ready-to-Paste Rewrites</CardTitle>
                    <CardDescription className="text-xs text-stone-400">
                      Profile alignment, photo detection, and AI-generated headline/summary rewrites
                    </CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-bold text-stone-100">
                    {linkedin?.score ?? 0}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono"> / 100</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Profile Completeness</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {linkedin?.has_complete_profile ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Incomplete Sections
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Skills Relevance</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {linkedin?.skills_relevant ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Target Role Aligned
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Needs Role Alignment
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">Photo Detection</span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {(linkedin?.has_photo ?? linkedin?.photo_detected) ? (
                      <span className="text-orange-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Professional Photo
                      </span>
                    ) : (
                      <span className="text-stone-400 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Photo Not Found
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ready-to-Paste Rewrites List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Ready-to-Paste Profile Rewrites (1-Click Copy)
                  </span>
                </div>

                {Boolean(linkedin?.suggested_rewrites?.length) ? (
                  <div className="grid gap-3">
                    {linkedin?.suggested_rewrites?.map((rewrite, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-stone-800 bg-stone-900/60 p-4 space-y-2 relative group hover:border-[#D93829]/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#D93829]">
                            Suggested Rewrite #{i + 1}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyRewrite(rewrite, i)}
                            className="h-7 px-2.5 border-stone-700 bg-stone-800 text-[11px] text-stone-200 hover:bg-stone-700 gap-1"
                          >
                            {copiedRewriteIndex === i ? (
                              <>
                                <Check className="h-3 w-3 text-orange-400" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs leading-relaxed text-stone-200 font-sans whitespace-pre-wrap">
                          {rewrite}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-800 p-6 text-center text-xs text-stone-500">
                    No specific LinkedIn rewrites generated yet. Add your LinkedIn profile text or PDF on the Profile page to receive personalized copy.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SECTION 4: RAW GRANULAR JSON INSPECTOR */}
          <Card className="rounded-2xl border border-stone-800 bg-stone-900 shadow-md shadow-black/40">
            <CardHeader className="border-b border-stone-800/80 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-400">
                    <Code2 className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm font-bold text-stone-100">Granular JSON Engine Output</CardTitle>
                    <CardDescription className="text-xs text-stone-400">
                      Exhaustive JSON output for developers, audits, and programmatic verification
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyRawJson}
                    className="border-stone-800 bg-stone-900 text-xs text-stone-300 hover:bg-stone-800 h-8 gap-1.5"
                  >
                    {copiedRawJson ? <Check className="h-3.5 w-3.5 text-orange-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedRawJson ? 'Copied' : 'Copy JSON'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadJson}
                    className="border-stone-800 bg-stone-900 text-xs text-stone-300 hover:bg-stone-800 h-8 gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <pre className="max-h-[500px] overflow-auto rounded-xl border border-stone-800/80 bg-stone-950 p-4 font-mono text-[11px] leading-relaxed text-stone-300 select-all">
                {rawJsonFormatted}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
