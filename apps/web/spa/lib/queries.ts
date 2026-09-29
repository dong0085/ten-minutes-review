import { useQuery } from "@tanstack/react-query";
import type {
  Category,
  ClassroomDailyStatus,
  ExamReview,
  QuestionType,
  TutorAnalysis,
  TutorHint,
} from "@tmr/core";
import type { AnswerShape } from "@/spa/components/quiz/question-review";
import { api } from "./api";

export type ClassroomSummary = {
  id: string;
  name: string;
  targetLanguage: string;
  nativeLanguage: string;
  autoStopDays: number;
  activeUntil: string;
  pausedAt: string | null;
  isActive: boolean;
  bankSize: number;
  todayQuizId: string | null;
  status: ClassroomDailyStatus;
  quizDaysRemaining: number;
};

export type ClassroomList = {
  classrooms: ClassroomSummary[];
  limits: { classrooms: number; uploadsPerMonth: number; uploadsThisMonth: number } | null;
};

export type Classroom = {
  id: string;
  name: string;
  targetLanguage: string;
  nativeLanguage: string;
  autoStopDays: number;
  quizLength: number;
  activeUntil: string;
  pausedAt: string | null;
  includeAnswersInEmail: boolean;
  isActive: boolean;
  bankSize: number;
};

export type QuizListItem = {
  id: string;
  quizDate: string;
  kind: "daily" | "manual" | "exam";
  size: number;
  composedAt: string;
  bestScore: number | null;
  attemptCount: number;
};

export type ClassroomOverview = {
  today: string;
  dailyQuizId: string | null;
  composeJob: { id: string; status: "pending" | "running"; requestedAt: string } | null;
  counts: { uploads: number; pendingUploads: number; bank: number; quizzes: number };
  bankByCategory: Record<Category, number>;
  lastUploadAt: string | null;
  /** On-demand quizzes made in the last 24 hours, taken or not, newest first. */
  recentOnDemand: QuizListItem[];
  unfinished: Array<Omit<QuizListItem, "bestScore" | "attemptCount">>;
  mistakes: number;
  exam: {
    requiredPoints: number;
    composeJob: { id: string; status: "pending" | "running"; requestedAt: string } | null;
    latest: { id: string; quizDate: string; attemptCount: number; bestScore: number | null } | null;
  };
};

export type Upload = {
  id: string;
  kind: "text" | "image";
  textContent: string | null;
  originalFilename: string | null;
  extractionStatus: "pending" | "running" | "done" | "failed";
  extractionError: string | null;
  subject: string | null;
  discardedCount: number;
  createdAt: string;
  imageUrl: string | null;
};

export type BankItem = {
  id: string;
  category: Category;
  targetText: string;
  nativeText: string | null;
  note: string | null;
  inferred: boolean;
  sourceExcerpt: string | null;
  isRetired: boolean;
  retiredAt: string | null;
  createdAt: string;
  answered: number;
  missed: number;
};

export type QuizQuestion = {
  id: string;
  position: number;
  category: Category;
  type: QuestionType;
  stem: string;
  options: string[] | null;
  imageUrl: string | null;
  knowledgePointId: string;
  isKnowledgePointRetired: boolean;
};

export type Quiz = {
  id: string;
  quizDate: string;
  kind: "daily" | "manual" | "exam";
  size: number;
  classroomId: string;
  classroomName: string;
  questions: QuizQuestion[];
};

export type AttemptSummary = {
  id: string;
  submittedAt: string;
  correctCount: number;
  questionCount: number;
  durationMs: number;
};

export type AttemptReview = {
  attempt: AttemptSummary & { quizId: string };
  answers: Array<{
    questionId: string;
    knowledgePointId: string;
    isKnowledgePointRetired: boolean;
    position: number;
    category: Category;
    type: QuestionType;
    stem: string;
    options: string[] | null;
    response: AnswerShape;
    isCorrect: boolean;
    correctAnswer: AnswerShape;
    explanation: string;
  }>;
};

export const keys = {
  classrooms: ["classrooms"] as const,
  classroom: (id: string) => ["classroom", id] as const,
  overview: (id: string) => ["classroom", id, "overview"] as const,
  uploads: (id: string) => ["classroom", id, "uploads"] as const,
  bank: (id: string) => ["classroom", id, "bank"] as const,
  quizzes: (id: string) => ["classroom", id, "quizzes"] as const,
  quiz: (quizId: string) => ["quiz", quizId] as const,
  attempt: (attemptId: string) => ["attempt", attemptId] as const,
  attemptReview: (attemptId: string) => ["attempt", attemptId, "review"] as const,
  mistakes: (id: string) => ["classroom", id, "mistakes"] as const,
};

export function useClassrooms(enabled = true) {
  return useQuery({
    queryKey: keys.classrooms,
    queryFn: () => api.get<ClassroomList>("/api/classrooms"),
    enabled,
  });
}

export function useClassroom(id: string) {
  return useQuery({
    queryKey: keys.classroom(id),
    queryFn: async () => (await api.get<{ classroom: Classroom }>(`/api/classrooms/${id}`)).classroom,
  });
}

export function useOverview(id: string) {
  return useQuery({
    queryKey: keys.overview(id),
    queryFn: () => api.get<ClassroomOverview>(`/api/classrooms/${id}/overview`),
  });
}

const READING_POLL_MS = 4000;

export function isReading(upload: Upload) {
  return upload.extractionStatus === "pending" || upload.extractionStatus === "running";
}

/** Polls while the worker is still reading an upload. */
export function useUploads(id: string) {
  return useQuery({
    queryKey: keys.uploads(id),
    queryFn: async () =>
      (await api.get<{ uploads: Upload[] }>(`/api/classrooms/${id}/uploads`)).uploads,
    refetchInterval: (query) =>
      query.state.data?.some(isReading) ? READING_POLL_MS : false,
  });
}

export function useBank(id: string) {
  return useQuery({
    queryKey: keys.bank(id),
    queryFn: async () =>
      (await api.get<{ knowledgePoints: BankItem[] }>(`/api/classrooms/${id}/knowledge-points`))
        .knowledgePoints,
  });
}

export function useQuizzes(id: string) {
  return useQuery({
    queryKey: keys.quizzes(id),
    queryFn: async () =>
      (await api.get<{ quizzes: QuizListItem[] }>(`/api/classrooms/${id}/quizzes`)).quizzes,
  });
}

export function useQuiz(quizId: string) {
  return useQuery({
    queryKey: keys.quiz(quizId),
    queryFn: () =>
      api.get<{ quiz: Quiz; attempts: AttemptSummary[] }>(
        `/api/quizzes/${quizId}?includeAttempts=1`,
      ),
  });
}

export type AttemptReviewState = {
  status: "none" | "writing" | "ready" | "failed";
  review: ExamReview | null;
};

const REVIEW_POLL_MS = 2500;

/** The AI review of an exam attempt, polled while the worker writes it. */
export function useAttemptReview(attemptId: string, enabled = true) {
  return useQuery({
    queryKey: keys.attemptReview(attemptId),
    queryFn: () => api.get<AttemptReviewState>(`/api/attempts/${attemptId}/review`),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.status === "writing" ? REVIEW_POLL_MS : false,
  });
}

export type Mistake = {
  question: {
    id: string;
    knowledgePointId: string;
    category: Category;
    type: QuestionType;
    stem: string;
    options: string[] | null;
  };
  source: { quizId: string; kind: QuizListItem["kind"]; quizDate: string };
  firstMissedAt: string;
  missCount: number;
  tutor: TutorNote[];
};

export type TutorNote = {
  id: string;
  questionId: string;
  mode: "hint" | "analysis";
  level: number;
  status: "pending" | "done" | "failed";
  content: TutorHint | TutorAnalysis | null;
  createdAt: string;
};

export function useMistakes(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.mistakes(id),
    queryFn: () => api.get<{ windowDays: number; mistakes: Mistake[] }>(`/api/classrooms/${id}/mistakes`),
    enabled,
  });
}

export function useAttempt(attemptId: string) {
  return useQuery({
    queryKey: keys.attempt(attemptId),
    queryFn: () => api.get<AttemptReview>(`/api/attempts/${attemptId}`),
  });
}
