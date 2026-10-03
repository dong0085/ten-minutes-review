import { runExtractJob } from "@tmr/db";
import type { Db } from "@tmr/db";
import { getLlmProvider } from "../llm";
import { getObjectBytes } from "../storage";

export async function handleExtractJob(
  db: Db,
  payload: Record<string, unknown>,
): Promise<void> {
  const provider = getLlmProvider();
  const outcome = await runExtractJob(db, payload, {
    extract: (input) => provider.extract(input),
    loadImage: getObjectBytes,
  });
  if (outcome.kind === "first") {
    console.log(
      `[worker] extract ${outcome.uploadId}: ${outcome.result.points} knowledge points, ${outcome.result.discarded} discarded`,
    );
  } else if (outcome.result) {
    const { updated, added, removed } = outcome.result;
    console.log(
      `[worker] reread ${outcome.uploadId}: ${updated} updated, ${added} added, ${removed} removed`,
    );
  } else {
    console.log(`[worker] reread ${outcome.uploadId}: stale request, nothing changed`);
  }
}
