// Runs the composition prompt over saved cases and scores the questions it writes.
//
//   pnpm --filter worker eval                      # current prompt, every case
//   pnpm --filter worker eval --prompt draft.txt   # a draft prompt from a file, for every case
//   pnpm --filter worker eval --only exam          # exam cases use the exam prompt
//   pnpm --filter worker eval --runs 3 --label v4  # repeat each case, name the run
//   pnpm --filter worker eval --no-judge           # code checks only
//   pnpm --filter worker eval --review             # add the Jev review-and-rewrite step
//
// Reads cases from src/eval/cases and .eval/cases, writes results to .eval/results.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  COMPOSITION_PROMPT_V5,
  COMPOSITION_PROMPT_VERSION,
  EXAM_PROMPT_V2,
  EXAM_PROMPT_VERSION,
  parseCompositionResponse,
  parseCompositionResult,
} from "@tmr/core";
import type { CompositionQuestion } from "@tmr/core";
import { env } from "../env";
import { createJevClient } from "../jev";
import { reviewAndRewrite } from "../review";
import type { ReviewStats } from "../review";
import { getLlmProvider } from "../llm";
import type { CompositionPayload } from "../llm";
import { checkCase } from "./checks";
import type { CaseCheck } from "./checks";
import { JUDGE_PROMPT, judgePayload, parseJudgeResponse } from "./judge";
import type { JudgeReview } from "./judge";
import { renderReport, summarize } from "./report";

export type EvalCase = { name: string; payload: CompositionPayload };

export type CaseResult = {
  name: string;
  run: number;
  error: string | null;
  questions: CompositionQuestion[];
  check: CaseCheck | null;
  reviews: (JudgeReview | null)[] | null;
  /** Set when the run used the Jev review step. */
  review: ReviewStats | null;
  seconds: number;
};

export type EvalRun = {
  label: string;
  promptVersion: string;
  model: string;
  startedAt: string;
  judged: boolean;
  reviewed: boolean;
  results: CaseResult[];
};

const WORKER_DIR = path.resolve(import.meta.dirname, "../..");
const CASE_DIRS = [path.join(import.meta.dirname, "cases"), path.join(WORKER_DIR, ".eval/cases")];
const RESULTS_DIR = path.join(WORKER_DIR, ".eval/results");
const CONCURRENCY = 4;

async function loadCases(only: string | undefined): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  for (const dir of CASE_DIRS) {
    const files = await readdir(dir).catch(() => [] as string[]);
    for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
      const name = file.replace(/\.json$/, "");
      if (only && !name.includes(only)) {
        continue;
      }
      const payload = JSON.parse(await readFile(path.join(dir, file), "utf8")) as CompositionPayload;
      cases.push({ name, payload });
    }
  }
  return cases;
}

/** Exam cases give each knowledge point the question type it must be tested with. */
function isExamCase(evalCase: EvalCase): boolean {
  return evalCase.payload.knowledgePoints.some((point) => point.type);
}

async function runCase(
  evalCase: EvalCase,
  run: number,
  promptOverride: string | undefined,
  judge: boolean,
  review: boolean,
): Promise<CaseResult> {
  const started = Date.now();
  const provider = getLlmProvider();
  const result: CaseResult = {
    name: evalCase.name,
    run,
    error: null,
    questions: [],
    check: null,
    reviews: null,
    review: null,
    seconds: 0,
  };
  try {
    const systemPrompt = promptOverride ?? (isExamCase(evalCase) ? EXAM_PROMPT_V2 : COMPOSITION_PROMPT_V5);
    const raw = await provider.compose({ systemPrompt, payload: evalCase.payload });
    const parsed = typeof raw === "string" ? parseCompositionResponse(raw) : parseCompositionResult(raw);
    result.questions = parsed.questions;
    if (review) {
      const outcome = await reviewAndRewrite({
        jev: createJevClient(),
        provider,
        payload: evalCase.payload,
        questions: parsed.questions,
      });
      result.questions = outcome.kept;
      result.review = outcome.stats;
    }
    result.check = checkCase(evalCase.payload, result.questions);
    if (judge && result.questions.length > 0) {
      const verdict = await provider.compose({
        systemPrompt: JUDGE_PROMPT,
        payload: judgePayload(evalCase.payload, result.questions),
      });
      result.reviews = parseJudgeResponse(verdict, result.questions.length);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  result.seconds = Math.round((Date.now() - started) / 100) / 10;
  return result;
}

async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(work))));
  }
  return results;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      prompt: { type: "string" },
      runs: { type: "string", default: "1" },
      label: { type: "string" },
      only: { type: "string" },
      "no-judge": { type: "boolean", default: false },
      review: { type: "boolean", default: false },
    },
  });
  if (env.llmProvider === "mock") {
    console.warn("[eval] LLM_PROVIDER is mock: this checks the plumbing, not the prompt.");
  }
  const promptOverride = values.prompt
    ? await readFile(path.resolve(process.cwd(), values.prompt), "utf8")
    : undefined;
  // The mock provider only writes quizzes, so it cannot judge them.
  const judged = !values["no-judge"] && env.llmProvider !== "mock";
  const reviewed = values.review;
  const runs = Math.max(1, Number(values.runs) || 1);
  const cases = await loadCases(values.only);
  if (cases.length === 0) {
    throw new Error("no eval cases found");
  }
  const promptVersion = promptOverride
    ? path.basename(values.prompt ?? "")
    : cases.some(isExamCase)
      ? `${COMPOSITION_PROMPT_VERSION}+${EXAM_PROMPT_VERSION}`
      : COMPOSITION_PROMPT_VERSION;

  const model = env.llmProvider === "mock" ? "mock" : env.deepseekModel;
  const label = values.label ?? `${promptVersion}${reviewed ? "+jev" : ""}-${model}`;
  console.log(`[eval] ${cases.length} cases × ${runs} runs · prompt ${promptVersion} · model ${model}`);

  const jobs = cases.flatMap((evalCase) =>
    Array.from({ length: runs }, (_, run) => ({ evalCase, run })),
  );
  const results = await inBatches(jobs, CONCURRENCY, async ({ evalCase, run }) => {
    const result = await runCase(evalCase, run, promptOverride, judged, reviewed);
    console.log(
      `[eval] ${evalCase.name}#${run}: ${result.error ?? `${result.questions.length} questions`} (${result.seconds}s)`,
    );
    return result;
  });

  const evalRun: EvalRun = {
    label,
    promptVersion,
    model,
    startedAt: new Date().toISOString(),
    judged,
    reviewed,
    results,
  };
  const stamp = evalRun.startedAt.replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(RESULTS_DIR, `${stamp}-${label.replace(/[^\w.-]+/g, "_")}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "results.json"), JSON.stringify(evalRun, null, 2));
  await writeFile(path.join(outDir, "report.md"), renderReport(evalRun, cases));

  const summary = summarize(evalRun);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`[eval] report: ${path.relative(process.cwd(), path.join(outDir, "report.md"))}`);
}

main().catch((error) => {
  console.error("[eval] failed", error);
  process.exitCode = 1;
});
