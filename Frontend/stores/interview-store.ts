'use client';

import { create } from 'zustand';
import type {
  InterviewSession,
  InterviewConfig,
  InterviewQuestion,
  QuestionAnswer,
  InterviewFeedback,
  InterviewType,
} from '@/types';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { questionBank, generalQuestions } from '@/lib/fixtures/interview-questions';
import { FREE_SESSION_LIMIT } from '@/lib/config';

function pickQuestions(config: InterviewConfig): InterviewQuestion[] {
  const typeBank = questionBank[config.type] || questionBank.technical;
  const questions: InterviewQuestion[] = [];
  const seenIds = new Set<string>();

  const addQuestions = (qs: InterviewQuestion[]) => {
    for (const question of qs) {
      if (!seenIds.has(question.id)) {
        seenIds.add(question.id);
        questions.push(question);
      }
    }
  };

  for (const topic of config.topics) {
    const topicQuestions = typeBank[topic];
    if (topicQuestions) {
      addQuestions(topicQuestions);
    }
  }

  for (const topic of config.topics) {
    if (typeBank[topic]) continue;
    for (const bankType of Object.keys(questionBank) as InterviewType[]) {
      if (bankType === config.type) continue;
      const crossBank = questionBank[bankType];
      if (crossBank[topic]) {
        addQuestions(crossBank[topic].slice(0, 2));
      }
    }
  }

  const roleBank = questionBank.role_specific[config.targetRole];
  if (roleBank && config.type !== 'role_specific') {
    addQuestions(roleBank.slice(0, 1));
  }

  if (questions.length < 5) {
    const general = typeBank['General'] || generalQuestions;
    for (const gq of general) {
      if (questions.length >= 5) break;
      addQuestions([gq]);
    }
  }

  if (questions.length < 5) {
    for (const gq of generalQuestions) {
      if (questions.length >= 5) break;
      addQuestions([gq]);
    }
  }

  return questions.slice(0, 8);
}

function generateFeedback(session: InterviewSession): InterviewFeedback {
  const answered = session.answers.filter((a) => a.answerText.trim().length > 0);
  const totalQuestions = session.questions.length;
  const answeredCount = answered.length;
  const completionRatio = totalQuestions > 0 ? answeredCount / totalQuestions : 0;

  const questionFeedback = session.questions.map((q) => {
    const ans = answered.find((a) => a.questionId === q.id);
    const hasAnswer = !!ans && ans.answerText.trim().length > 0;
    const answerLength = ans?.answerText.trim().length || 0;

    const baseScore = hasAnswer ? Math.min(60 + answerLength / 5, 85) : 30;
    const score = Math.round(baseScore + Math.random() * 10);

    return {
      questionId: q.id,
      score: Math.min(score, 95),
      technicalCorrectness: Math.min(Math.round(score * 0.9 + Math.random() * 5), 95),
      answerClarity: Math.min(Math.round(score * 0.95 + Math.random() * 5), 95),
      communicationQuality: Math.min(Math.round(score * 0.85 + Math.random() * 10), 95),
      strengths: hasAnswer
        ? ['Clear explanation structure', 'Good use of relevant terminology']
        : ['No answer submitted'],
      weaknesses: hasAnswer
        ? ['Could provide more concrete examples', 'Depth on edge cases is limited']
        : ['No answer provided for this question'],
      missingConcepts: (q.expectedConcepts || []).slice(0, 2),
      suggestedImprovements: hasAnswer
        ? ['Add a real-world example to illustrate the concept', 'Discuss performance implications']
        : ['Review this topic and practise answering it'],
    };
  });

  const overallScore = Math.round(
    questionFeedback.reduce((sum, qf) => sum + qf.score, 0) / Math.max(questionFeedback.length, 1)
  );

  const topicScores: Record<string, number[]> = {};
  for (const q of session.questions) {
    const qf = questionFeedback.find((f) => f.questionId === q.id);
    if (qf) {
      if (!topicScores[q.topic]) topicScores[q.topic] = [];
      topicScores[q.topic].push(qf.score);
    }
  }

  const topicAverages = Object.entries(topicScores).map(([topic, scores]) => ({
    topic,
    avg: scores.reduce((s, v) => s + v, 0) / scores.length,
  }));

  const sorted = [...topicAverages].sort((a, b) => b.avg - a.avg);
  const strongestTopics = sorted.slice(0, 2).map((t) => t.topic);
  const weakAreas = sorted.slice(-2).map((t) => t.topic);

  return {
    sessionId: session.id,
    overallScore: Math.round(overallScore * completionRatio + overallScore * 0.3),
    summary:
      completionRatio > 0.7
        ? 'Solid overall performance. Your answers show good understanding of the core concepts. Focus on providing more concrete examples and deepening your knowledge on the weaker topics.'
        : 'You left several questions unanswered. Aim to attempt every question, even if you are not fully confident. Review the topics below and practise again.',
    strongestTopics,
    weakAreas,
    recommendedPracticeTopics: weakAreas,
    questionFeedback,
  };
}

interface InterviewState {
  sessions: InterviewSession[];
  activeSessionId: string | null;
  isHydrated: boolean;

  hydrate: () => void;
  createSession: (config: InterviewConfig, userId: string) => string;
  startSession: (sessionId: string) => void;
  submitAnswer: (sessionId: string, questionId: string, answerText: string) => void;
  completeSession: (sessionId: string) => void;
  abandonSession: (sessionId: string) => void;
  getSession: (sessionId: string) => InterviewSession | undefined;
  getCompletedCount: () => number;
  getRemainingCount: () => number;
  canStartNew: () => boolean;
}

export const useInterviewStore = create<InterviewState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isHydrated: false,

  hydrate: () => {
    const sessions = loadFromStorage<InterviewSession[]>('interview-sessions', []);
    set({ sessions, isHydrated: true });
  },

  createSession: (config: InterviewConfig, userId: string) => {
    const id = 'session-' + Date.now();
    const questions = pickQuestions(config);
    const session: InterviewSession = {
      id,
      userId,
      config,
      status: 'configured',
      questions,
      answers: [],
      createdAt: new Date().toISOString(),
    };
    const sessions = [...get().sessions, session];
    saveToStorage('interview-sessions', sessions);
    set({ sessions, activeSessionId: id });
    return id;
  },

  startSession: (sessionId: string) => {
    const sessions = get().sessions.map((s) =>
      s.id === sessionId && s.status === 'configured'
        ? { ...s, status: 'in_progress' as const, startedAt: new Date().toISOString() }
        : s
    );
    saveToStorage('interview-sessions', sessions);
    set({ sessions, activeSessionId: sessionId });
  },

  submitAnswer: (sessionId: string, questionId: string, answerText: string) => {
    const sessions = get().sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const existingIdx = s.answers.findIndex((a) => a.questionId === questionId);
      const answer: QuestionAnswer = {
        questionId,
        answerText,
        submittedAt: new Date().toISOString(),
      };
      const answers =
        existingIdx >= 0
          ? s.answers.map((a, i) => (i === existingIdx ? answer : a))
          : [...s.answers, answer];
      return { ...s, answers };
    });
    saveToStorage('interview-sessions', sessions);
    set({ sessions });
  },

  completeSession: (sessionId: string) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.status === 'completed') return;

    const feedback = generateFeedback(session);
    const sessions = get().sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            status: 'completed' as const,
            completedAt: new Date().toISOString(),
            feedback,
          }
        : s
    );
    saveToStorage('interview-sessions', sessions);
    set({ sessions, activeSessionId: null });
  },

  abandonSession: (sessionId: string) => {
    const sessions = get().sessions.map((s) =>
      s.id === sessionId && s.status === 'in_progress'
        ? { ...s, status: 'abandoned' as const }
        : s
    );
    saveToStorage('interview-sessions', sessions);
    set({ sessions, activeSessionId: null });
  },

  getSession: (sessionId: string) => get().sessions.find((s) => s.id === sessionId),

  getCompletedCount: () => get().sessions.filter((s) => s.status === 'completed').length,

  getRemainingCount: () => {
    const completed = get().sessions.filter((s) => s.status === 'completed').length;
    return Math.max(0, FREE_SESSION_LIMIT - completed);
  },

  canStartNew: () => {
    const completed = get().sessions.filter((s) => s.status === 'completed').length;
    return completed < FREE_SESSION_LIMIT;
  },
}));
