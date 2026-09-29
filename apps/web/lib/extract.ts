import { eq } from "drizzle-orm";
import {
  EXTRACTION_PROMPT_V2,
  EXTRACTION_PROMPT_VERSION,
  parseExtractionResponse,
  parseExtractionResult,
} from "@tmr/core";
import type { KnowledgePointDetail } from "@tmr/core";
import {
  claimSpecificJob,
  classrooms,
  completeJob,
  completeUploadExtraction,
  failJob,
  failUploadExtraction,
  getUploadById,
  insertKnowledgePoints,
  insertPassages,
  markUploadRunning,
  runInLlmScope,
} from "@tmr/db";
import type { NewKnowledgePoint } from "@tmr/db";
import { getDb } from "./db";
import { getLlmProvider } from "./llm";
import type { LlmImage } from "./llm";
import { getObjectBytes } from "./storage";

function passageDetail(passageId: string): KnowledgePointDetail {
  return { passage_ref: passageId } as unknown as KnowledgePointDetail;
}

function normalizeSubject(value: string | null): string | null {
  const subject = value?.replace(/\s+/g, " ").trim();
  return subject ? subject.slice(0, 120) : null;
}

export async function processUploadExtraction(
  uploadId: string,
  jobId?: string,
): Promise<void> {
  const db = getDb();

  if (jobId) {
    const claimed = await claimSpecificJob(db, jobId, "web-after");
    if (!claimed) {
      // The job was already claimed or processed by the worker
      return;
    }
  }

  const upload = await getUploadById(db, uploadId);
  if (!upload) {
    if (jobId) {
      await failJob(db, jobId, `upload ${uploadId} not found`);
    }
    return;
  }

  try {
    await markUploadRunning(db, uploadId);

    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, upload.classroomId))
      .limit(1);

    const images: LlmImage[] = [];
    if (upload.kind === "image") {
      if (!upload.storageKey) {
        throw new Error(`image upload ${uploadId} has no storage key`);
      }
      const object = await getObjectBytes(upload.storageKey);
      images.push({ bytes: object.bytes, mimeType: upload.mimeType ?? object.mimeType });
    }

    const provider = getLlmProvider();
    const raw = await runInLlmScope(
      { db, jobId: jobId ?? null, userId: classroom?.userId ?? null },
      () =>
        provider.extract({
          systemPrompt: EXTRACTION_PROMPT_V2,
          text: upload.kind === "text" ? upload.textContent : null,
          images,
          targetHint: classroom?.targetLanguage ?? null,
        }),
    );
    const result =
      typeof raw === "string" ? parseExtractionResponse(raw) : parseExtractionResult(raw);

    const insertedPassages = await insertPassages(
      db,
      result.passages.map((passage) => ({
        classroomId: upload.classroomId,
        sourceUploadId: upload.id,
        targetText: passage.target_text,
        nativeText: passage.native_text,
        sourceExcerpt: passage.source_excerpt,
      })),
    );

    const rows: NewKnowledgePoint[] = [];
    for (const point of result.knowledge_points) {
      const targetText = point.target_text?.trim();
      if (!targetText) {
        continue;
      }

      let detail: KnowledgePointDetail = null;
      if (point.category === "grammar" && point.grammar) {
        detail = { grammar: point.grammar };
      }
      if (point.category === "comprehension") {
        const reference = point.passage_ref;
        const passage = reference === null ? undefined : insertedPassages[reference];
        if (!passage) {
          continue;
        }
        detail = passageDetail(passage.id);
      }

      rows.push({
        classroomId: upload.classroomId,
        sourceUploadId: upload.id,
        category: point.category,
        targetText,
        nativeText: point.native_text,
        inferred: point.inferred,
        note: point.note,
        detail,
        sourceExcerpt: point.source_excerpt,
        promptVersion: EXTRACTION_PROMPT_VERSION,
      });
    }

    const inserted = await insertKnowledgePoints(db, rows);
    await completeUploadExtraction(
      db,
      uploadId,
      result.discarded,
      normalizeSubject(result.subject),
    );
    if (jobId) {
      await completeJob(db, jobId);
    }
    console.log(
      `[web-after] extract ${uploadId}: ${inserted.length} knowledge points, ${result.discarded.length} discarded`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[web-after] extract ${uploadId} failed:`, error);
    await failUploadExtraction(db, uploadId, message);
    if (jobId) {
      await failJob(db, jobId, message);
    }
  }
}
