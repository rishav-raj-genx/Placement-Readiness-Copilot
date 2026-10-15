export type UserRole = 'student' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
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

export type ApplicationStatus = 'saved' | 'applied' | 'interviewing';

export interface JobApplication {
  id: string;
  userId: string;
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  applicationDate: string;
  notes?: string;
  jobPostingUrl?: string;
  createdAt: string;
}

export type JobStatus = 'published' | 'unpublished';

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
}

export type ChatMessageRole = 'user' | 'assistant';
export type AttachmentStatus = 'uploaded' | 'processing' | 'analyzed' | 'error';

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: AttachmentStatus;
  statusMessage: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  attachments?: ChatAttachment[];
  timestamp: string;
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
