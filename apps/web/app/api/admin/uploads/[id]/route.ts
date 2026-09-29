import { eq } from "drizzle-orm";
import { enqueueJob, getUploadAdminDetail, uploads } from "@tmr/db";
import { jsonError, jsonOk } from "@/lib/api";
import { adminRoute, audit } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { objectUrl } from "@/lib/storage";

export const GET = adminRoute<{ id: string }>(async ({ admin, params }) => {
  const detail = await getUploadAdminDetail(getDb(), params.id);
  if (!detail) {
    return jsonError("Not found", 404);
  }
  await audit(admin, "view_user_content", { type: "user", id: String(detail.upload.userId) }, {
    uploadId: params.id,
  });
  const storageKey = detail.upload.storage_key;
  const imageUrl = typeof storageKey === "string" ? await objectUrl(storageKey).catch(() => null) : null;
  return jsonOk({ ...detail, imageUrl });
});

/** Re-runs extraction for an upload that failed or never finished. */
export const POST = adminRoute<{ id: string }>(async ({ admin, params }) => {
  const db = getDb();
  const detail = await getUploadAdminDetail(db, params.id);
  if (!detail) {
    return jsonError("Not found", 404);
  }
  if (detail.upload.extraction_status === "done") {
    return jsonError("This upload was already extracted", 409);
  }
  await db
    .update(uploads)
    .set({ extractionStatus: "pending", extractionError: null })
    .where(eq(uploads.id, params.id));
  const job = await enqueueJob(db, { kind: "extract", payload: { uploadId: params.id } });
  await audit(admin, "reextract_upload", { type: "user", id: String(detail.upload.userId) }, {
    uploadId: params.id,
    jobId: job?.id,
  });
  return jsonOk({ jobId: job?.id ?? null });
});
