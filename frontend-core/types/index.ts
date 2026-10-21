export type UserRole = 'student' | 'admin';

export interface CandidateProject {
  id?: string;
  name?: string;
  title?: string;
  repositoryUrl?: string;
  repoUrl?: string;
  githubUrl?: string;
  liveUrl?: string;
  description: string;
}

export type ProjectItem = CandidateProject;

export interface CoCurricularProfile {
  hackathonsCount: number;
  certificationsCount: number;
  clubLeadership: boolean;
}

export type ProfileAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  targetRole?: string;
  targetLocations: string[];
  skills: string[];
  githubUsername?: string;
  resumePdfPath?: string;
  linkedinPdfPath?: string;
  linkedinText?: string;
  leetcodeUrl?: string;
  codingProfileUrl?: string;
  projects: CandidateProject[];
  coCurricular?: CoCurricularProfile;
  interviewCredits?: number;
  isPremium?: boolean;
  onboardingCompletedAt?: string;
  updatedAt?: string;
}

export type InterviewType =
  | 'technical'
  | 'coding'
  | 'hr'
  | 'behavioral'
  | 'system_design'
  | 'role_specific'
  | 'custom';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

export type ExperienceLevel = 'internship' | 'entry_level' | 'one_to_three' | 'three_plus';

export type CompanyType = 'product_based' | 'startup' | 'service_based' | 'other';

export type SessionStatus = 'configured' | 'in_progress' | 'completed' | 'abandoned';

export interface InterviewConfig {
  type: InterviewType;
  targetRole: string;
  topics: string[];
  customInstructions?: string;
  difficulty: Difficulty;
  experienceLevel: ExperienceLevel;
  durationMinutes: number;
  targetCompany?: string;
  companyType?: CompanyType;
  jobDescription?: string;
  resumeContext?: string;
}

export interface InterviewQuestion {
  id: string;
  topic: string;
  questionText: string;
  questionType: 'open_ended' | 'coding' | 'system_design' | 'behavioral';
  expectedConcepts?: string[];
}

export interface QuestionAnswer {
  questionId: string;
  answerText: string;
  submittedAt: string;
}

export interface QuestionFeedback {
  questionId: string;
  score: number;
  technicalCorrectness: number;
  answerClarity: number;
  communicationQuality: number;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  suggestedImprovements: string[];
}

export interface InterviewFeedback {
  sessionId: string;
  overallScore: number;
  summary: string;
  strongestTopics: string[];
  weakAreas: string[];
  recommendedPracticeTopics: string[];
  questionFeedback: QuestionFeedback[];
}

export interface InterviewSession {
  id: string;
  userId: string;
  config: InterviewConfig;
  status: SessionStatus;
  questions: InterviewQuestion[];
  answers: QuestionAnswer[];
  feedback?: InterviewFeedback;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'shortlisted'
  | 'interview'
  | 'interviewing'
  | 'offer'
  | 'rejected';

export const KANBAN_COLUMNS: Array<{ id: ApplicationStatus; label: string }> = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
];

export interface JobApplication {
  id: string;
  userId: string;
  jobId?: string;
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  applicationDate: string;
  notes?: string;
  jobPostingUrl?: string;
  followUpDate?: string;
  createdAt: string;
}

export type JobStatus = 'published' | 'unpublished';

export interface DiscoveredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  description: string;
  required_skills: string[]; // jsonb mapped to array
  matched_skills: string[]; // jsonb mapped to array
  relevance_score: number; // numeric(5,2)
  match_reason: string;
  is_remote: boolean;
  job_type: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship';
  publication_status: 'published' | 'unpublished';
  is_msot_post: boolean;
  posted_at: string;
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship';
  description: string;
  requiredSkills: string[];
  applicationUrl?: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  source?: string;
  matchedSkills?: string[];
  matchScore?: number;
  matchReason?: string;
  isRemote?: boolean;
  postedAt?: string;
}

export type ChatMessageRole = 'user' | 'assistant';
export type AttachmentStatus = 'uploaded' | 'processing' | 'analyzed' | 'error';
export type ChatAttachmentKind = 'resume' | 'document' | 'profile_link';

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: AttachmentStatus;
  statusMessage: string;
  kind: ChatAttachmentKind;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  attachments?: ChatAttachment[];
  timestamp: string;
}

export interface ReadinessAction {
  title: string;
  priority: string;
  category?: string;
  potentialPointGain?: number;
  description?: string;
}

export interface ReadinessBreakdownItem {
  rawScore: number;
  weight: number;
  weightedPoints: number;
  present: boolean;
}

export interface ReadinessScore {
  totalScore: number;
  readinessLevel: string;
  topActions: ReadinessAction[];
  breakdown: Record<string, ReadinessBreakdownItem>;
  isProvisional?: boolean;
  missingComponents?: string[];
  updatedAt?: string;
}

export interface ResumeReviewResult {
  score: number;
  page_count: number;
  is_one_page: boolean;
  is_ats_friendly: boolean;
  uses_action_verbs: boolean;
  has_spelling_or_grammar_issues: boolean;
  spelling_grammar_issues: string[];
  specific_fixes: string[];
}

export interface GithubReviewResult {
  score: number;
  specific_fixes: string[];
}

export interface LinkedInReviewResult {
  score: number;
  has_complete_profile: boolean;
  skills_relevant: boolean;
  suggested_rewrites: string[];
}

export interface CandidateProfileReview {
  resume_review: ResumeReviewResult;
  github_review: GithubReviewResult;
  linkedin_review: LinkedInReviewResult | null;
  total_readiness_score: number;
}

export interface CandidateProfileReviewRecord {
  studentId: string;
  status: ProfileAnalysisStatus;
  result: CandidateProfileReview | null;
  errorMessage?: string;
  updatedAt: string;
}

export type DocumentType = 'resume' | 'job_description' | 'project_description';

export interface UserDocument {
  id: string;
  userId: string;
  type: DocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  analysisStatus: 'not_analyzed' | 'analyzing' | 'analyzed' | 'error';
  extractedSkills?: string[];
  analysisNote: string;
}

// ---------------------------------------------------------------------------
// LiveKit mock interview types
// ---------------------------------------------------------------------------

export type LiveKitSessionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'active'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

export interface LiveKitSessionResponse {
  serverUrl: string;
  roomName: string;
  token: string;
  interviewId: string;
}

export interface LiveKitSessionRequest {
  studentId?: string;
  targetRole: string;
  jobId?: string;
  resumeId?: string;
  topics?: string[];
  difficulty?: string;
  durationMinutes?: number;
  experienceLevel?: string;
  companyType?: string;
  targetCompany?: string;
  customInstructions?: string;
  focusAreas?: string[];
  mode?: 'voice' | 'text';
  provider?: 'cloud_api' | 'ollama_local';
}

export interface LiveKitGreetingPayload {
  message: string;
}

export interface LiveKitQuestionPayload {
  questionId: string;
  text: string;
  questionNumber: number;
  totalQuestions: number;
}

export interface LiveKitTranscriptPayload {
  id?: string;
  speaker: 'student' | 'interviewer';
  text: string;
  final?: boolean;
  timestamp: number;
}

export interface LiveKitCategoryScore {
  category: string;
  score: number;
  benchmark: number;
  strengths: string[];
  critiques: string[];
}

export interface LiveKitSuggestedFix {
  title: string;
  location: string;
  recommendedChange: string;
}

export interface LiveKitResultsPayload {
  overallReadinessDelta: number;
  finalScore: number;
  summary: string;
  categoryScores: LiveKitCategoryScore[];
  suggestedFixes: LiveKitSuggestedFix[];
  timestamp: number;
  isFallback?: boolean;
  evaluationMode?: string;
  rubricVersion?: string;
  isProvisional?: boolean;
  transcript?: LiveKitTranscriptEntry[];
}

export interface LiveKitErrorPayload {
  code: string;
  message: string;
}

export type LiveKitEventName =
  | 'interview:greeting'
  | 'interview:question'
  | 'interview:transcript'
  | 'interview:results'
  | 'interview:error';

export interface LiveKitEvent {
  event: LiveKitEventName;
  payload:
    | LiveKitGreetingPayload
    | LiveKitQuestionPayload
    | LiveKitTranscriptPayload
    | LiveKitResultsPayload
    | LiveKitErrorPayload;
}

export interface LiveKitTranscriptEntry {
  id: string;
  speaker: 'student' | 'interviewer';
  text: string;
  final?: boolean;
  timestamp: number;
}
