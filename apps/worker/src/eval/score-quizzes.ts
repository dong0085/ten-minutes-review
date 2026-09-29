// Scores quizzes learners already received, with the eval's code checks and judge.
//
//   pnpm --filter worker eval:score-quizzes --email you@example.com            # today
//   pnpm --filter worker eval:score-quizzes --email you@example.com --days 14  # the last two weeks
//
// Reads only. Prints each question with its score and the learner's result.
import { parseArgs } from "node:util";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import type { CompositionQuestion } from "@tmr/core";
import {
  attemptAnswers,
  attempts,
  classrooms,
  createDbConnection,
  knowledgePoints,
  questions,
  quizzes,
  users,
} from "@tmr/db";
import { env } from "../env";
import { getLlmProvider } from "../llm";
import type { CompositionPayload } from "../llm";
import { checkQuestion } from "./checks";
import { JUDGE_PROMPT, failedChecks, judgePayload, parseJudgeResponse } from "./judge";
import type { JudgeReview } from "./judge";

function isoDate(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString("en-CA");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      days: { type: "string", default: "1" },
    },
  });
  if (!values.email) {
    throw new Error("usage: eval:score-quizzes --email <email> [--days N]");
  }
  const since = isoDate(Math.max(1, Number(values.days) || 1) - 1);
  const connection = createDbConnection(env.databaseUrl, 1);
  const provider = getLlmProvider();
  const reviews: JudgeReview[] = [];
  try {
    const db = connection.db;
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, values.email));
    if (!user) {
      throw new Error("no user with that email");
    }
    const found = await db
      .select({ quiz: quizzes, classroom: classrooms })
      .from(quizzes)
      .innerJoin(classrooms, eq(quizzes.classroomId, classrooms.id))
      .where(and(eq(quizzes.userId, user.id), gte(quizzes.quizDate, since)))
      .orderBy(desc(quizzes.quizDate));
    if (found.length === 0) {
      console.log(`[score] no quizzes since ${since}`);
      return;
    }

    for (const { quiz, classroom } of found) {
      const rows = await db
        .select()
        .from(questions)
        .where(eq(questions.quizId, quiz.id))
        .orderBy(asc(questions.position));
      const points = await db
        .select()
        .from(knowledgePoints)
        .where(inArray(knowledgePoints.id, rows.map((row) => row.knowledgePointId)));
      const [attempt] = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(eq(attempts.quizId, quiz.id))
        .orderBy(desc(attempts.submittedAt))
        .limit(1);
      const results = attempt
        ? await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attempt.id))
        : [];
      const correctById = new Map(results.map((row) => [row.questionId, row.isCorrect]));

      const payload: CompositionPayload = {
        targetLanguage: classroom.targetLanguage,
        nativeLanguage: classroom.nativeLanguage,
        size: rows.length,
        knowledgePoints: points.map((point) => ({
          id: point.id,
          category: point.category,
          target: point.targetText,
          native: point.nativeText,
          detail: point.detail,
        })),
        alreadyAskedStems: [],
        recentMisses: [],
      };
      const composed: CompositionQuestion[] = rows.map((row) => ({
        knowledge_point_id: row.knowledgePointId,
        category: row.category,
        type: row.type,
        stem: row.stem,
        options: row.options,
        answer: row.answer,
        explanation: row.explanation,
      }));
      const verdict = await provider.compose({ systemPrompt: JUDGE_PROMPT, payload: judgePayload(payload, composed) });
      const quizReviews = parseJudgeResponse(verdict, composed.length);

      const scored = quizReviews.filter((review) => review !== null);
      reviews.push(...scored);
      const mean = scored.length ? scored.reduce((sum, review) => sum + review.score, 0) / scored.length : 0;
      console.log(
        `\n## ${quiz.quizDate} · ${classroom.name} · ${quiz.kind} · prompt ${quiz.promptVersion} · ` +
          `${rows.length} questions · mean score ${mean.toFixed(2)}`,
      );
      for (const [index, row] of rows.entries()) {
        const review = quizReviews[index];
        const question = composed[index];
        if (!question) {
          continue;
        }
        const marks = [...checkQuestion(question, new Set()), ...(review ? failedChecks(review) : [])];
        const outcome = correctById.has(row.id) ? (correctById.get(row.id) ? "✓" : "✗") : "·";
        const answer = "index" in row.answer ? row.options?.[row.answer.index] : "blanks" in row.answer ? row.answer.blanks.join(" | ") : String(row.answer.value);
        console.log(
          `${String(index + 1).padStart(2)}. [${review?.score ?? "?"}] ${outcome} ${row.stem}` +
            (row.options ? `\n      options: ${row.options.join(" / ")}` : "") +
            `\n      answer: ${answer}` +
            (marks.length ? `\n      ⚠ ${marks.join(", ")}` : "") +
            (review?.problem ? `\n      judge: ${review.problem}` : ""),
        );
      }
    }
  } finally {
    await connection.close();
  }

  const mean = reviews.reduce((sum, review) => sum + review.score, 0) / (reviews.length || 1);
  const poor = reviews.filter((review) => review.score <= 2).length;
  console.log(
    `\n[score] ${reviews.length} questions · mean ${mean.toFixed(2)} · scored 1–2: ${poor} (${Math.round((poor / (reviews.length || 1)) * 100)}%)`,
  );
}

main().catch((error) => {
  console.error("[score] failed", error);
  process.exitCode = 1;
});
