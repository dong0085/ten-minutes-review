import { dailySendAt, formatMessage, getMessages, toUiLocale } from "@tmr/core";
import type { QuizKind, UiLocale } from "@tmr/core";
import { createUnsubscribeToken } from "@tmr/core/node";
import {
  getClassroom,
  getEmailPreferences,
  getEmailSend,
  getEmailSendByQuiz,
  getQuizWithQuestionsForUser,
  getUserById,
  listDailyEmailQuizzesForUserOnDate,
  recordEmailSend,
} from "@tmr/db";
import type { Db } from "@tmr/db";
import { env } from "../env";
import { escapeHtml, renderDailyQuizEmail, sendEmail } from "../email";
import type { DailyQuizEmailEntry } from "../email";

const UNSUBSCRIBE_TOKEN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export type EmailQuestion = {
  position: number;
  category: string;
  type: string;
  stem: string;
  options: string[] | null;
};

export type EmailQuizData = {
  classroomName: string;
  quiz: { id: string; classroomId: string };
  questions: EmailQuestion[];
};

export function buildEmailEntries(
  appUrl: string,
  quizzes: EmailQuizData[],
): DailyQuizEmailEntry[] {
  return quizzes.map((entry) => ({
    classroomName: entry.classroomName,
    quizUrl: `${appUrl}/classrooms/${entry.quiz.classroomId}/quiz/${entry.quiz.id}`,
    questions: entry.questions.map((question) => ({
      position: question.position,
      category: question.category,
      type: question.type,
      stem: question.stem,
      options: question.options,
    })),
  }));
}

export function withUnsubscribeFooter(
  html: string,
  text: string,
  unsubscribeUrl: string,
  locale: UiLocale,
): { html: string; text: string } {
  const messages = getMessages(locale).Email;
  const htmlFooter = `<p style="color: #737373; font-size: 13px;">${escapeHtml(messages.unsubscribeWhy)} <a href="${escapeHtml(unsubscribeUrl)}">${escapeHtml(messages.unsubscribeAction)}</a></p>`;
  const textFooter = `\n${messages.unsubscribeWhy}\n${messages.unsubscribeAction}: ${unsubscribeUrl}\n`;
  return { html: `${html}\n${htmlFooter}`, text: `${text}${textFooter}` };
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value) {
    throw new Error(`send_email job payload is missing ${key}`);
  }
  return value;
}

function dailyCutoff(payload: Record<string, unknown>): Date {
  if (typeof payload.sendAt === "string") {
    const parsed = new Date(payload.sendAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return dailySendAt();
}

export async function handleSendEmailJob(
  db: Db,
  payload: Record<string, unknown>,
): Promise<void> {
  const userId = requireString(payload, "userId");
  const quizDate = requireString(payload, "quizDate");
  const kind: QuizKind = payload.kind === "manual" ? "manual" : "daily";

  const preferences = await getEmailPreferences(db, userId);
  if (preferences && (!preferences.dailyEnabled || preferences.unsubscribedAt !== null)) {
    return;
  }

  const user = await getUserById(db, userId);
  if (!user) {
    throw new Error(`user ${userId} not found`);
  }

  const quizzes: EmailQuizData[] = [];
  let quizId: string | null = null;

  if (kind === "manual") {
    quizId = requireString(payload, "quizId");
    const alreadySent = await getEmailSendByQuiz(db, userId, quizId);
    if (alreadySent) {
      return;
    }
    const full = await getQuizWithQuestionsForUser(db, userId, quizId);
    if (!full || full.quiz.kind !== "manual") {
      return;
    }
    const classroom = await getClassroom(db, userId, full.quiz.classroomId);
    if (!classroom) {
      return;
    }
    quizzes.push({
      classroomName: classroom.name,
      quiz: { id: full.quiz.id, classroomId: full.quiz.classroomId },
      questions: full.questions.map((question) => ({
        position: question.position,
        category: question.category,
        type: question.type,
        stem: question.stem,
        options: question.options,
      })),
    });
  } else {
    const alreadySent = await getEmailSend(db, userId, quizDate, "daily");
    if (alreadySent) {
      return;
    }
    const rows = await listDailyEmailQuizzesForUserOnDate(
      db,
      userId,
      quizDate,
      dailyCutoff(payload),
    );
    if (rows.length === 0) {
      return;
    }
    for (const row of rows) {
      const full = await getQuizWithQuestionsForUser(db, userId, row.quiz.id);
      if (!full) {
        continue;
      }
      quizzes.push({
        classroomName: row.classroomName,
        quiz: { id: full.quiz.id, classroomId: full.quiz.classroomId },
        questions: full.questions.map((question) => ({
          position: question.position,
          category: question.category,
          type: question.type,
          stem: question.stem,
          options: question.options,
        })),
      });
    }
    if (quizzes.length === 0) {
      return;
    }
  }

  const entries = buildEmailEntries(env.appUrl, quizzes);
  const locale = toUiLocale(user.uiLanguage);
  const message = renderDailyQuizEmail({ locale, username: user.username, entries });
  const unsubscribeUrl = `${env.appUrl}/unsubscribe?token=${createUnsubscribeToken(
    userId,
    env.authSecret,
    new Date(Date.now() + UNSUBSCRIBE_TOKEN_DAYS * DAY_MS),
  )}`;
  const { html, text } = withUnsubscribeFooter(message.html, message.text, unsubscribeUrl, locale);

  const { id } = await sendEmail({
    to: user.email,
    subject: message.subject,
    html,
    text,
  });

  const recorded = await recordEmailSend(db, {
    userId,
    sentOn: quizDate,
    kind,
    quizId,
    classroomIds: quizzes.map((quiz) => quiz.quiz.classroomId),
    providerMessageId: id,
  });
  if (!recorded) {
    console.log(
      `[worker] send_email ${kind} ${userId} ${quizDate}: already recorded, skipping`,
    );
    return;
  }
  console.log(
    `[worker] send_email ${kind} ${userId} ${quizDate}: ${entries.length} classroom(s)`,
  );
}
