'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Check,
  Clock,
  Target,
  Building2,
  Briefcase,
  GraduationCap,
  AlertCircle,
  Info,
  Github,
  Linkedin,
  FileText,
  Upload,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { DemoLabel } from '@/components/shared/demo-label';
import { useAuthStore } from '@/stores/auth-store';
import { useInterviewStore } from '@/stores/interview-store';
import { toast } from 'sonner';
import type { InterviewType, Difficulty, ExperienceLevel, CompanyType, InterviewConfig, LiveKitSessionRequest } from '@/types';
import { FREE_SESSION_LIMIT } from '@/lib/config';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase-client';
import { createInterviewSession } from '@/lib/livekit-session';
import { useLiveKitInterviewStore } from '@/stores/livekit-interview-store';

const targetRoles = [
  'Software Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'Data Analyst',
  'Data Scientist',
  'AI/ML Engineer',
  'DevOps Engineer',
  'Other',
];

const companyTypes: { value: CompanyType; label: string }[] = [
  { value: 'product_based', label: 'Product-based company' },
  { value: 'startup', label: 'Startup' },
  { value: 'service_based', label: 'Service-based company' },
  { value: 'other', label: 'Other / Not sure' },
];

const experienceLevels: { value: ExperienceLevel; label: string }[] = [
  { value: 'internship', label: 'Internship' },
  { value: 'entry_level', label: 'Entry-level / Fresher' },
  { value: 'one_to_three', label: '1–3 years' },
  { value: 'three_plus', label: '3+ years' },
];

const difficulties: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'adaptive', label: 'Adaptive' },
];

const durations = [15, 30, 45];

const companySuggestions = [
  'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix',
  'Stripe', 'Uber', 'Airbnb', 'Spotify', 'Adobe', 'Salesforce',
];

const allSupportedTopics = [
  'React',
  'JavaScript',
  'TypeScript',
  'Node.js',
  'CSS',
  'Performance',
  'State Management',
  'Data Structures',
  'Algorithms',
  'Dynamic Programming',
  'System Design',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'General',
];

type RoleKey =
  | 'Software Engineer'
  | 'Frontend Developer'
  | 'Backend Developer'
  | 'Full-Stack Developer'
  | 'Data Analyst'
  | 'Data Scientist'
  | 'AI/ML Engineer'
  | 'DevOps Engineer'
  | 'Other';

const roleTopicRecommendations: Record<RoleKey, string[]> = {
  'Software Engineer': ['Data Structures', 'Algorithms', 'System Design', 'JavaScript', 'General'],
  'Frontend Developer': ['React', 'JavaScript', 'CSS', 'Performance', 'Frontend Developer'],
  'Backend Developer': ['Node.js', 'JavaScript', 'System Design', 'Backend Developer'],
  'Full-Stack Developer': ['React', 'Node.js', 'JavaScript', 'State Management', 'Full Stack Developer'],
  'Data Analyst': ['Data Structures', 'Algorithms', 'General'],
  'Data Scientist': ['Data Structures', 'Algorithms', 'General'],
  'AI/ML Engineer': ['Data Structures', 'Algorithms', 'General'],
  'DevOps Engineer': ['System Design', 'Node.js', 'General'],
  'Other': ['General'],
};

const companyTypeTopicBoosts: Record<CompanyType, string[]> = {
  product_based: ['Data Structures', 'Algorithms', 'System Design'],
  startup: ['JavaScript', 'React', 'Node.js'],
  service_based: ['JavaScript', 'General'],
  other: [],
};

function getRecommendedTopics(role: string, companyType: CompanyType): string[] {
  const roleKey = (targetRoles.includes(role) ? role : 'Other') as RoleKey;
  const roleTopics = roleTopicRecommendations[roleKey] || ['General'];
  const boostTopics = companyTypeTopicBoosts[companyType] || [];

  const merged = [...roleTopics];
  for (const t of boostTopics) {
    if (!merged.includes(t)) merged.push(t);
  }

  const supported = merged.filter((t) => allSupportedTopics.includes(t));
  return supported.length > 0 ? supported : ['General'];
}

function getInterviewTypeForTopics(topics: string[]): InterviewType {
  if (topics.includes('Data Structures') || topics.includes('Algorithms') || topics.includes('Dynamic Programming')) {
    return 'coding';
  }
  if (topics.includes('System Design')) {
    return 'system_design';
  }
  if (topics.includes('General') && topics.length === 1) {
    return 'behavioral';
  }
  return 'technical';
}

export default function ConfigureInterviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { canStartNew, getCompletedCount, getRemainingCount } = useInterviewStore();
  const { startInterview: startLiveKitInterview, setCreating, setCreateError } = useLiveKitInterviewStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [targetRole, setTargetRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        companyDropdownRef.current &&
        !companyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredCompanySuggestions = useMemo(() => {
    if (!targetCompany.trim()) return companySuggestions;
    const query = targetCompany.toLowerCase().trim();
    return companySuggestions.filter((c) => c.toLowerCase().includes(query));
  }, [targetCompany]);
  const [companyType, setCompanyType] = useState<CompanyType>('other');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('entry_level');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [duration, setDuration] = useState(30);
  const [customInstructions, setCustomInstructions] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [linkedinPdfFile, setLinkedinPdfFile] = useState<File | null>(null);
  const [resumePdfPath, setResumePdfPath] = useState('');
  const [linkedinPdfPath, setLinkedinPdfPath] = useState('');
  const [resumePdfName, setResumePdfName] = useState('');
  const [linkedinPdfName, setLinkedinPdfName] = useState('');
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [isSavingReadiness, setIsSavingReadiness] = useState(false);

  const canStart = canStartNew();
  const remainingCount = getRemainingCount();
  const completedCount = getCompletedCount();

  const effectiveRole = targetRole === 'Other' ? customRole.trim() : targetRole;
  const readinessComplete = Boolean(
    githubUsername.trim() &&
      linkedinUrl.trim() &&
      resumePdfPath && linkedinPdfPath
  );
  const recommendedTopics = useMemo(
    () => getRecommendedTopics(effectiveRole, companyType),
    [effectiveRole, companyType]
  );

  const addTopic = (topic: string) => {
    const trimmed = topic.trim();
    if (trimmed && !topics.includes(trimmed)) {
      setTopics([...topics, trimmed]);
    }
    setTopicInput('');
  };

  const removeTopic = (topic: string) => {
    setTopics(topics.filter((t) => t !== topic));
  };

  const acceptRecommended = () => {
    const merged = [...topics];
    for (const r of recommendedTopics) {
      if (!merged.includes(r)) merged.push(r);
    }
    setTopics(merged);
  };

  const isRecommended = (topic: string) => recommendedTopics.includes(topic);

  useEffect(() => {
    const savedReadiness = loadFromStorage<{
      githubUsername?: string;
      linkedinUrl?: string;
      resumePdfName?: string;
      linkedinPdfName?: string;
    }>('interview-readiness', {});

    setGithubUsername(savedReadiness.githubUsername || '');
    setLinkedinUrl(savedReadiness.linkedinUrl || '');
    setResumePdfName(savedReadiness.resumePdfName || '');
    setLinkedinPdfName(savedReadiness.linkedinPdfName || '');

    if (!user) return;

    let active = true;
    supabase
      .from('profiles')
      .select('github_username, linkedin_url, resume_pdf_path, linkedin_pdf_path')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setGithubUsername(data.github_username || '');
        setLinkedinUrl(data.linkedin_url || '');
        setResumePdfPath(data.resume_pdf_path || '');
        setLinkedinPdfPath(data.linkedin_pdf_path || '');
      });

    return () => {
      active = false;
    };
  }, [user]);

  const canProceedToStep2 =
    targetRole.trim() !== '' && (targetRole !== 'Other' || customRole.trim() !== '');

  const handleProceed = () => {
    if (!canProceedToStep2) {
      toast.error('Please select a target role');
      return;
    }
    if (topics.length === 0) {
      acceptRecommended();
    }
    setStep(2);
  };

  const saveReadiness = async (): Promise<boolean> => {
    if (!githubUsername.trim() || !linkedinUrl.trim() || (!resumeFile && !resumePdfPath && !resumePdfName) || (!linkedinPdfFile && !linkedinPdfPath && !linkedinPdfName)) {
      toast.error('Add your GitHub ID, LinkedIn profile, LinkedIn PDF, and resume PDF first.');
      return false;
    }

    const files = [resumeFile, linkedinPdfFile].filter(Boolean) as File[];
    if (files.some((file) => file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024)) {
      toast.error('Upload PDF files smaller than 10 MB.');
      return false;
    }

    setIsSavingReadiness(true);
    try {
      if (user) {
        const uploadedPaths: { resume?: string; linkedin?: string } = {};
        for (const [file, name] of [[resumeFile, 'resume.pdf'], [linkedinPdfFile, 'linkedin.pdf']] as const) {
          if (!file) continue;
          const path = `${user.id}/${name}`;
          const { error } = await supabase.storage.from('candidate-documents').upload(path, file, {
            contentType: 'application/pdf',
            upsert: true,
          });
          if (error) throw error;
          if (name === 'resume.pdf') uploadedPaths.resume = path;
          else uploadedPaths.linkedin = path;
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            github_username: githubUsername.trim(),
            linkedin_url: linkedinUrl.trim(),
            ...(uploadedPaths.resume ? { resume_pdf_path: uploadedPaths.resume } : {}),
            ...(uploadedPaths.linkedin ? { linkedin_pdf_path: uploadedPaths.linkedin } : {}),
          })
          .eq('id', user.id);
        if (error) throw error;

        if (uploadedPaths.resume) setResumePdfPath(uploadedPaths.resume);
        if (uploadedPaths.linkedin) setLinkedinPdfPath(uploadedPaths.linkedin);
      } else throw new Error('You must be signed in to save interview readiness.');
      return true;
    } catch {
      toast.error('We could not save your interview documents. Please try again.');
      return false;
    } finally {
      setIsSavingReadiness(false);
    }
  };

  const handleBegin = async () => {
    if (!readinessComplete) {
      setStep(1);
      setReadinessOpen(true);
      return;
    }
    if (topics.length === 0) {
      toast.error('Please select at least one topic');
      return;
    }
    if (!canStart) {
      toast.error('You have used all free interview sessions');
      return;
    }

    const readinessSaved = await saveReadiness();
    if (!readinessSaved) return;

    const type = getInterviewTypeForTopics(topics);
    if (user) {
      setCreating(true);
      setCreateError(null);
      try {
        const sessionRequest: LiveKitSessionRequest = {
          studentId: user.id,
          targetRole: effectiveRole,
          topics,
          difficulty,
          durationMinutes: duration,
          experienceLevel,
          companyType,
          targetCompany: targetCompany.trim() || undefined,
          customInstructions: customInstructions.trim() || undefined,
          focusAreas: topics,
        };

        const sessionResponse = await createInterviewSession(sessionRequest);
        startLiveKitInterview(
          sessionResponse.interviewId,
          sessionResponse.roomName,
          effectiveRole,
          sessionResponse.serverUrl,
          sessionResponse.token
        );
        toast.success('Interview session created. Connecting to live interview...');
        router.push(`/interview/session/${sessionResponse.interviewId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start live interview';
        setCreateError(message);
        toast.error(message);
      } finally {
        setCreating(false);
      }
      return;
    }

    toast.error('Your session has expired. Please sign in again.');
    router.push('/signin?redirectTo=/interview/configure');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Configure Your Interview"
        description="Set your target role, company context, and preparation topics to get a tailored practice session."
      />

      {!canStart && (
        <Card className="border-warning/30">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm text-foreground/80">
              You have used all {FREE_SESSION_LIMIT} free interview sessions. Please upgrade your plan or contact support for additional sessions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step Indicator */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-brand' : 'text-muted-foreground'}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step === 1 ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'}`}>
            1
          </span>
          <span className="text-sm font-medium">Choose Your Target</span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-brand' : 'text-muted-foreground'}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step === 2 ? 'bg-brand text-white' : 'bg-muted text-muted-foreground'}`}>
            2
          </span>
          <span className="text-sm font-medium">Personalize Topics</span>
        </div>
      </div>

      {/* STEP 1 — Choose Your Target */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Choose Your Target</CardTitle>
                <CardDescription>Select your target role, company, and company type.</CardDescription>
              </div>
              <DemoLabel />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Target Role */}
            <div className="space-y-2">
              <Label htmlFor="role-select">Target Role <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {targetRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setTargetRole(role);
                      setTopics([]);
                    }}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors text-left ${
                      targetRole === role
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              {targetRole === 'Other' && (
                <div className="pt-1">
                  <Input
                    id="role-custom"
                    placeholder="Enter your target role"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Target Company */}
            <div className="space-y-2" ref={companyDropdownRef}>
              <div className="flex items-center justify-between">
                <Label htmlFor="company" className="text-sm font-medium">
                  Target Company <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                {targetCompany && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetCompany('');
                      setIsCompanyDropdownOpen(false);
                    }}
                    className="text-xs text-muted-foreground hover:text-brand transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="company"
                  placeholder="e.g. Google, Stripe, or type any company"
                  value={targetCompany}
                  onChange={(e) => {
                    setTargetCompany(e.target.value);
                    if (!isCompanyDropdownOpen) setIsCompanyDropdownOpen(true);
                  }}
                  onFocus={() => setIsCompanyDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsCompanyDropdownOpen(false);
                    } else if (e.key === 'Enter' && isCompanyDropdownOpen) {
                      e.preventDefault();
                      if (filteredCompanySuggestions.length > 0) {
                        setTargetCompany(filteredCompanySuggestions[0]);
                        setIsCompanyDropdownOpen(false);
                      }
                    }
                  }}
                  className="h-11 pl-10 pr-10 text-sm bg-card border-border rounded-xl transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIsCompanyDropdownOpen((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
                  aria-label="Toggle company suggestions"
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isCompanyDropdownOpen && 'rotate-180'
                    )}
                  />
                </button>

                {/* Stylish Dropdown Menu */}
                {isCompanyDropdownOpen && (
                  <div
                    data-lenis-prevent="true"
                    data-lenis-prevent-wheel="true"
                    data-lenis-prevent-touch="true"
                    onWheel={(e) => e.stopPropagation()}
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-2 space-y-1 max-h-64 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/45 [&::-webkit-scrollbar-track]:bg-transparent animate-in fade-in-0 zoom-in-95 duration-150"
                  >
                    <div className="sticky top-0 bg-card/95 backdrop-blur-md z-10 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/50 pb-1.5 mb-1">
                      <span>Top Tech Companies</span>
                      <span className="text-[10px] text-muted-foreground/70 font-normal">Click or type custom</span>
                    </div>

                    {filteredCompanySuggestions.length > 0 ? (
                      filteredCompanySuggestions.map((company) => {
                        const isSelected = targetCompany.toLowerCase().trim() === company.toLowerCase();
                        return (
                          <button
                            type="button"
                            key={company}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setTargetCompany(company);
                              setIsCompanyDropdownOpen(false);
                            }}
                            className={cn(
                              'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-all',
                              isSelected
                                ? 'bg-brand text-white font-medium shadow-sm'
                                : 'text-foreground hover:bg-muted/80 hover:text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={cn(
                                  'flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold shrink-0 transition-colors',
                                  isSelected
                                    ? 'bg-white/20 border-white/30 text-white'
                                    : 'bg-muted border-border text-muted-foreground group-hover:border-brand/40 group-hover:text-brand'
                                )}
                              >
                                {company[0]}
                              </div>
                              <span className="truncate">{company}</span>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-white shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-xs text-muted-foreground space-y-1">
                        <p>No matching preset company.</p>
                      </div>
                    )}

                    {targetCompany.trim() && !companySuggestions.some((c) => c.toLowerCase() === targetCompany.toLowerCase().trim()) && (
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsCompanyDropdownOpen(false);
                        }}
                        className="cursor-pointer flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground bg-muted/50 border border-dashed border-border hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-brand shrink-0" />
                        <span className="truncate">
                          Using custom company: <strong className="text-foreground">{targetCompany.trim()}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                You can continue without a company. Company context helps tailor topic recommendations.
              </p>
            </div>

            {/* Required Profile Materials */}
            <div className="space-y-4 rounded-lg border border-brand/20 bg-brand/5 p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Upload className="h-4 w-4 text-brand" />
                  Required before your AI interview
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add your GitHub ID, LinkedIn profile, LinkedIn PDF, and resume PDF. MSOT uses these materials to make your questions more relevant.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="github-username">
                    GitHub ID <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Github className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="github-username"
                      placeholder="e.g. octocat"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin-url">
                    LinkedIn profile <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Linkedin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="linkedin-url"
                      type="url"
                      placeholder="https://linkedin.com/in/your-name"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { id: 'resume-pdf', label: 'Resume PDF', file: resumeFile, existingName: resumePdfName, onChange: setResumeFile },
                  { id: 'linkedin-pdf', label: 'LinkedIn PDF', file: linkedinPdfFile, existingName: linkedinPdfName, onChange: setLinkedinPdfFile },
                ].map((document) => (
                  <div key={document.id} className="space-y-2">
                    <Label htmlFor={document.id}>
                      {document.label} <span className="text-destructive">*</span>
                    </Label>
                    <label htmlFor={document.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border bg-card px-3 py-3 transition-colors hover:border-brand hover:bg-brand/5">
                      <FileText className="h-5 w-5 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {document.file?.name || document.existingName || 'Choose a PDF file'}
                      </span>
                      <span className="text-xs font-medium text-brand">Browse</span>
                    </label>
                    <input
                      id={document.id}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={(e) => document.onChange(e.target.files?.[0] || null)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Company Type */}
            <div className="space-y-2">
              <Label>Company Type</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {companyTypes.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => {
                      setCompanyType(ct.value);
                      setTopics([]);
                    }}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors text-center ${
                      companyType === ct.value
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div className="space-y-2">
              <Label>Experience Level</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {experienceLevels.map((el) => (
                  <button
                    key={el.value}
                    onClick={() => setExperienceLevel(el.value)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors text-center ${
                      experienceLevel === el.value
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {el.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button variant="brand" onClick={handleProceed} disabled={!canProceedToStep2}>
                Next: Personalize Topics
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2 — Personalize Your Preparation */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Personalize Your Preparation</CardTitle>
                <CardDescription>
                  Recommended topics for {effectiveRole} at a {companyTypes.find((c) => c.value === companyType)?.label.toLowerCase()}.
                </CardDescription>
              </div>
              <DemoLabel />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Target Summary */}
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Target className="h-3.5 w-3.5 text-brand" />
                {effectiveRole}
              </span>
              {targetCompany && (
                <>
                  <Separator orientation="vertical" className="h-3.5" />
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {targetCompany}
                  </span>
                </>
              )}
              <Separator orientation="vertical" className="h-3.5" />
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />
                {companyTypes.find((c) => c.value === companyType)?.label}
              </span>
              <Separator orientation="vertical" className="h-3.5" />
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5" />
                {experienceLevels.find((e) => e.value === experienceLevel)?.label}
              </span>
            </div>

            {/* Recommended Topics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Recommended Topics</Label>
                <button
                  onClick={acceptRecommended}
                  className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept all
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on your role and company context. You can customize these — add or remove topics below.
              </p>
              <div className="flex flex-wrap gap-2">
                {recommendedTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => addTopic(topic)}
                    disabled={topics.includes(topic)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      topics.includes(topic)
                        ? 'border-brand bg-brand/10 text-brand cursor-default'
                        : 'border-dashed border-border text-muted-foreground hover:border-brand hover:text-brand'
                    }`}
                  >
                    {topics.includes(topic) && <Check className="mr-1 inline h-3 w-3" />}
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Selected Topics */}
            <div className="space-y-2">
              <Label>Selected Topics</Label>
              {topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <Badge key={topic} variant="secondary" className="gap-1">
                      {isRecommended(topic) && (
                        <span className="text-brand" title="Recommended">•</span>
                      )}
                      {topic}
                      <button onClick={() => removeTopic(topic)} aria-label={`Remove ${topic}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No topics selected yet. Click recommended topics above or add your own.</p>
              )}
            </div>

            {/* Add Custom Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic-input">Add a Topic</Label>
              <div className="flex gap-2">
                <Input
                  id="topic-input"
                  placeholder="Type a topic and press Enter"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTopic(topicInput);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => addTopic(topicInput)}
                  disabled={!topicInput.trim()}
                  aria-label="Add topic"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allSupportedTopics
                  .filter((t) => !topics.includes(t) && !recommendedTopics.includes(t))
                  .map((topic) => (
                    <button
                      key={topic}
                      onClick={() => addTopic(topic)}
                      className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                    >
                      + {topic}
                    </button>
                  ))}
              </div>
            </div>

            <Separator />

            {/* Difficulty + Duration */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <div className="flex flex-wrap gap-2">
                  {difficulties.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        difficulty === d.value
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex flex-wrap gap-2">
                  {durations.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        duration === d
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions">
                Custom Instructions <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="instructions"
                placeholder="e.g. Focus on React hooks and state management. Ask behavioral questions too."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={2}
              />
            </div>

            {/* Honest info note */}
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              <span>
                Questions are drawn from MSOT&apos;s available question bank, tailored to your selected role and topics. MSOT does not claim access to any company&apos;s private interview questions.
              </span>
            </div>

            {/* Summary */}
            <div className="rounded-md bg-muted/50 p-4 space-y-2">
              <div className="text-sm font-medium">Session Summary</div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <span>Role: <span className="text-foreground">{effectiveRole}</span></span>
                {targetCompany && <span>Company: <span className="text-foreground">{targetCompany}</span></span>}
                <span>Company type: <span className="text-foreground">{companyTypes.find((c) => c.value === companyType)?.label}</span></span>
                <span>Experience: <span className="text-foreground">{experienceLevels.find((e) => e.value === experienceLevel)?.label}</span></span>
                <span>Topics: <span className="text-foreground">{topics.length > 0 ? topics.join(', ') : 'None'}</span></span>
                <span>Difficulty: <span className="text-foreground">{difficulty}</span></span>
                <span>Duration: <span className="text-foreground">{duration} minutes</span></span>
                <span>Sessions: <span className="text-foreground">{completedCount} completed / {FREE_SESSION_LIMIT} free</span></span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="brand"
                size="lg"
                onClick={handleBegin}
                disabled={!canStart || topics.length === 0}
              >
                <Brain className="mr-1.5 h-4 w-4" />
                Start Mock Interview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={readinessOpen} onOpenChange={setReadinessOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete your interview profile first</DialogTitle>
            <DialogDescription>
              To start an AI interview, add your GitHub ID, LinkedIn profile, LinkedIn PDF, and resume PDF. This check appears only while one of these items is missing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="popup-github">GitHub ID</Label>
              <Input
                id="popup-github"
                placeholder="e.g. octocat"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup-linkedin">LinkedIn profile</Label>
              <Input
                id="popup-linkedin"
                type="url"
                placeholder="https://linkedin.com/in/your-name"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { id: 'popup-resume', label: 'Resume PDF', file: resumeFile, existingName: resumePdfName, onChange: setResumeFile },
                { id: 'popup-linkedin-pdf', label: 'LinkedIn PDF', file: linkedinPdfFile, existingName: linkedinPdfName, onChange: setLinkedinPdfFile },
              ].map((document) => (
                <div key={document.id} className="space-y-2">
                  <Label htmlFor={document.id}>{document.label}</Label>
                  <label htmlFor={document.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 hover:border-brand">
                    <FileText className="h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {document.file?.name || document.existingName || 'Choose PDF'}
                    </span>
                  </label>
                  <input
                    id={document.id}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(e) => document.onChange(e.target.files?.[0] || null)}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadinessOpen(false)} disabled={isSavingReadiness}>
              Not now
            </Button>
            <Button
              variant="brand"
              onClick={async () => {
                if (await saveReadiness()) setReadinessOpen(false);
              }}
              disabled={isSavingReadiness}
            >
              {isSavingReadiness ? 'Saving...' : 'Save and continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
