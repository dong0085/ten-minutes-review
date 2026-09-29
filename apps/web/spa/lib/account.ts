import { useQuery } from "@tanstack/react-query";
import type { Category } from "@tmr/core";
import { api } from "./api";

export type ActivityStats = {
  attemptCount: number;
  quizCount: number;
  answeredCount: number;
  correctCount: number;
  totalDurationMs: number;
  activeDays: number;
};

export type LearningStats = {
  categories: Array<{ category: Category; answered: number; correct: number }>;
  practicedPoints: number;
  masteredPoints: number;
  bankPoints: number;
  gaps: Category[];
};

export type AttemptScore = {
  id: string;
  submittedAt: string;
  correctCount: number;
  questionCount: number;
};

export type RecentMiss = {
  knowledgePointId: string;
  stem: string;
  category: Category;
  missedAt: string;
};

export type AccountOverview = {
  activity: ActivityStats;
  learning: LearningStats;
  attempts: AttemptScore[];
  misses: RecentMiss[];
  quizzes: Array<{
    id: string;
    classroomId: string;
    classroomName: string;
    quizDate: string;
    size: number;
    bestScore: number | null;
    attemptCount: number;
  }>;
  hasMoreQuizzes: boolean;
  quizLimit: number;
  membership: {
    isPaid: boolean;
    paymentIssue: boolean;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    billingAction: "checkout" | "portal";
  };
  usage: {
    classrooms: number;
    uploadsThisMonth: number;
    classroomLimit: number;
    uploadLimit: number;
  };
};

export type Referrals = {
  code: string;
  shareUrl: string;
  referrals: Array<{ id: string; status: string; createdAt: string }>;
};

export type EmailPreferences = { dailyEnabled: boolean; unsubscribedAt: string | null };

export type ApiToken = {
  id: string;
  name: string | null;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function useAccountOverview() {
  return useQuery({
    queryKey: ["me", "overview"],
    queryFn: () => api.get<AccountOverview>("/api/me/overview"),
  });
}

export function useReferrals() {
  return useQuery({
    queryKey: ["me", "referrals"],
    queryFn: () => api.get<Referrals>("/api/me/referrals"),
  });
}

export function useEmailPreferences() {
  return useQuery({
    queryKey: ["me", "email-preferences"],
    queryFn: async () =>
      (await api.get<{ preferences: EmailPreferences }>("/api/me/email-preferences")).preferences,
  });
}

export function useApiTokens() {
  return useQuery({
    queryKey: ["me", "tokens"],
    queryFn: async () => (await api.get<{ tokens: ApiToken[] }>("/api/me/tokens")).tokens,
  });
}
