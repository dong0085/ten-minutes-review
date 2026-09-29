import type { CompositionQuestion } from "@tmr/core";
import type { CodeFlag } from "./checks";
import { JUDGE_CHECKS, failedChecks } from "./judge";
import type { JudgeCheck } from "./judge";
import type { ReviewStats } from "../review";
import type { EvalCase, EvalRun } from "./run";

export type EvalSummary = {
  label: string;
  cases: number;
  failedCalls: number;
  questions: number;
  /** Share of knowledge points that got a question. */
  coverage: number;
  /** Share of questions the worker would drop, and why. */
  dropRate: number;
  dropReasons: Partial<Record<string, number>>;
  codeFlags: Partial<Record<CodeFlag, number>>;
  judged: number;
  /** Mean judge score, 1–5. */
  meanScore: number | null;
  /** Share of judged questions scored 1 or 2. */
  poorRate: number | null;
  /** Share of judged questions failing each check. */
  checkFailRates: Partial<Record<JudgeCheck, number>>;
  /** Totals from the Jev review step, when the run used it. */
  review: ReviewStats | null;
};

function rate(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 1000;
}

function tally<K extends string>(keys: K[]): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const key of keys) {
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sumReviews(stats: (ReviewStats | null)[]): ReviewStats {
  const total: ReviewStats = { reviewed: 0, unreviewed: 0, rewritten: 0, rescued: 0, rejected: 0 };
  for (const entry of stats) {
    for (const key of Object.keys(total) as (keyof ReviewStats)[]) {
      total[key] += entry?.[key] ?? 0;
    }
  }
  return total;
}

export function summarize(run: EvalRun): EvalSummary {
  const ok = run.results.filter((result) => !result.error);
  const checked = ok.flatMap((result) => result.check?.questions ?? []);
  const pointCount = ok.reduce((sum, result) => sum + (result.check?.pointCount ?? 0), 0);
  const missing = ok.reduce((sum, result) => sum + (result.check?.missingPoints.length ?? 0), 0);
  const reviews = ok.flatMap((result) => result.reviews ?? []).filter((review) => review !== null);
  const dropped = checked.filter((entry) => entry.dropReason);

  return {
    label: run.label,
    cases: run.results.length,
    failedCalls: run.results.length - ok.length,
    questions: checked.length,
    coverage: rate(pointCount - missing, pointCount),
    dropRate: rate(dropped.length, checked.length),
    dropReasons: tally(dropped.map((entry) => entry.dropReason ?? "")),
    codeFlags: tally(checked.flatMap((entry) => entry.flags.filter((flag) => flag !== "dropped"))),
    judged: reviews.length,
    meanScore: reviews.length
      ? Math.round((reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length) * 100) / 100
      : null,
    poorRate: reviews.length ? rate(reviews.filter((review) => review.score <= 2).length, reviews.length) : null,
    review: run.reviewed ? sumReviews(ok.map((result) => result.review)) : null,
    checkFailRates: Object.fromEntries(
      JUDGE_CHECKS.map((check) => [
        check,
        rate(reviews.filter((review) => review[check] === false).length, reviews.length),
      ]),
    ),
  };
}

function answerText(question: CompositionQuestion): string {
  const answer = question.answer;
  if ("index" in answer) {
    return question.options?.[answer.index] ?? `#${answer.index}`;
  }
  if ("blanks" in answer) {
    return answer.blanks.join(" | ");
  }
  return String(answer.value);
}

function percent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 1000) / 10}%`;
}

export function renderReport(run: EvalRun, cases: EvalCase[]): string {
  const summary = summarize(run);
  const lines: string[] = [
    `# Eval: ${run.label}`,
    "",
    `Prompt \`${run.promptVersion}\`${run.reviewed ? " + Jev review" : ""} · model \`${run.model}\` · ${run.startedAt}`,
    "",
    "| Measure | Value |",
    "|---|---|",
    `| Cases (failed calls) | ${summary.cases} (${summary.failedCalls}) |`,
    `| Questions | ${summary.questions} |`,
    `| Points covered | ${percent(summary.coverage)} |`,
    `| Dropped by worker | ${percent(summary.dropRate)} |`,
    `| Judge mean score | ${summary.meanScore ?? "–"} |`,
    `| Judge score 1–2 | ${percent(summary.poorRate)} |`,
    ...JUDGE_CHECKS.map(
      (check) => `| Fails \`${check}\` | ${percent(run.judged ? summary.checkFailRates[check] ?? 0 : null)} |`,
    ),
    ...(summary.review
      ? [
          `| Jev reviewed (unreviewed) | ${summary.review.reviewed} (${summary.review.unreviewed}) |`,
          `| Jev rewrites kept / set aside | ${summary.review.rescued} / ${summary.review.rejected} |`,
        ]
      : []),
    ...Object.entries(summary.dropReasons).map(([reason, count]) => `| Dropped: ${reason} | ${count} |`),
    ...Object.entries(summary.codeFlags).map(([flag, count]) => `| Flag \`${flag}\` | ${count} |`),
    "",
  ];

  const payloads = new Map(cases.map((evalCase) => [evalCase.name, evalCase.payload]));
  for (const result of run.results) {
    lines.push(`## ${result.name} #${result.run}`, "");
    if (result.error) {
      lines.push(`**Failed:** ${result.error}`, "");
      continue;
    }
    const points = new Map(payloads.get(result.name)?.knowledgePoints.map((point) => [point.id, point]));
    if (result.check?.missingPoints.length) {
      lines.push(`**No question for:** ${result.check.missingPoints.join(", ")}`, "");
    }
    for (const [index, entry] of (result.check?.questions ?? []).entries()) {
      const { question } = entry;
      const review = result.reviews?.[index] ?? null;
      const point = points.get(question.knowledge_point_id);
      const marks = [
        ...entry.flags.map((flag) => (flag === "dropped" ? `dropped: ${entry.dropReason}` : flag)),
        ...(review ? failedChecks(review) : []),
      ];
      lines.push(
        `${index + 1}. **${question.stem}** — ${question.type}, ${question.category}` +
          (review ? ` · score **${review.score}**` : ""),
        `   - Point: ${point ? `${point.target} → ${point.native ?? "–"}` : question.knowledge_point_id}`,
      );
      if (question.options) {
        lines.push(`   - Options: ${question.options.join(" / ")}`);
      }
      lines.push(`   - Answer: ${answerText(question)}`);
      if (marks.length) {
        lines.push(`   - ⚠ ${marks.join(", ")}`);
      }
      if (review?.problem) {
        lines.push(`   - Judge: ${review.problem}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
