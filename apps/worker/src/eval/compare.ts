// Prints the summaries of two or more eval runs side by side.
//
//   pnpm --filter worker eval:compare .eval/results/<a> .eval/results/<b>
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JUDGE_CHECKS } from "./judge";
import { summarize } from "./report";
import type { EvalSummary } from "./report";
import type { EvalRun } from "./run";

function cell(value: number | null | undefined, asPercent: boolean): string {
  if (value === null || value === undefined) {
    return "–";
  }
  return asPercent ? `${Math.round(value * 1000) / 10}%` : String(value);
}

async function main(): Promise<void> {
  const dirs = process.argv.slice(2);
  if (dirs.length < 2) {
    throw new Error("usage: eval:compare <resultsDir> <resultsDir> [...]");
  }
  const summaries: EvalSummary[] = [];
  for (const dir of dirs) {
    const run = JSON.parse(
      await readFile(path.join(path.resolve(process.cwd(), dir), "results.json"), "utf8"),
    ) as EvalRun;
    summaries.push(summarize(run));
  }

  const rows: [string, (summary: EvalSummary) => number | null | undefined, boolean][] = [
    ["questions", (summary) => summary.questions, false],
    ["failed calls", (summary) => summary.failedCalls, false],
    ["points covered", (summary) => summary.coverage, true],
    ["dropped by worker", (summary) => summary.dropRate, true],
    ["jev rewrites kept", (summary) => summary.review?.rescued, false],
    ["jev set aside", (summary) => summary.review?.rejected, false],
    ["judge mean score ↑", (summary) => summary.meanScore, false],
    ["judge score 1–2 ↓", (summary) => summary.poorRate, true],
    ...JUDGE_CHECKS.map(
      (check) =>
        [`fails ${check} ↓`, (summary: EvalSummary) => summary.checkFailRates[check], true] as [
          string,
          (summary: EvalSummary) => number | undefined,
          boolean,
        ],
    ),
  ];
  const table = rows.map(([name, pick, asPercent]) => [
    name,
    ...summaries.map((summary) => cell(pick(summary), asPercent)),
  ]);
  const header = ["", ...summaries.map((summary) => summary.label)];
  const widths = header.map((_, column) =>
    Math.max(...[header, ...table].map((row) => row[column]?.length ?? 0)),
  );
  for (const row of [header, ...table]) {
    console.log(row.map((value, column) => value.padEnd(widths[column] ?? 0)).join("  "));
  }
}

main().catch((error) => {
  console.error("[eval] compare failed", error);
  process.exitCode = 1;
});
