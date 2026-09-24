import { after } from "next/server";
import { z } from "zod";
import {
  FREE_TIER,
  MAX_IMAGE_BYTES,
  MAX_UPLOADS_PER_USER_PER_DAY,
  startOfMonthAt,
} from "@tmr/core";
import {
  countUploadsSince,
  createUpload,
  enqueueJob,
  extendClassroomActivity,
  getClassroom,
  hasPaidPlan,
  listUploadsForUser,
} from "@tmr/db";
import { handleRouteError, jsonError, jsonOk, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { processUploadExtraction } from "@/lib/extract";
import { getCurrentUserOrGuest } from "@/lib/session";
import { objectUrl, putObject } from "@/lib/storage";

export const maxDuration = 60;

const textUploadSchema = z.object({
  text: z.string().trim().min(1),
});

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
]);

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
};

function resolveImageMime(file: File): string | null {
  if (IMAGE_MIME_TYPES.has(file.type)) {
    return file.type;
  }
  const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  return EXTENSION_MIME_TYPES[extension] ?? null;
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return cleaned || "image";
}

const FREE_UPLOAD_LIMIT = "Free plan is limited to 2 notes uploads per month";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }
    const rows = await listUploadsForUser(db, user.id, id);
    const uploads = await Promise.all(
      rows.map(async ({ upload }) => ({
        id: upload.id,
        kind: upload.kind,
        textContent: upload.textContent,
        originalFilename: upload.originalFilename,
        mimeType: upload.mimeType,
        byteSize: upload.byteSize,
        extractionStatus: upload.extractionStatus,
        extractedAt: upload.extractedAt,
        extractionError: upload.extractionError,
        subject: upload.subject,
        discardedCount: upload.discarded.length,
        createdAt: upload.createdAt,
        imageUrl:
          upload.kind === "image" && upload.storageKey
            ? await objectUrl(upload.storageKey).catch(() => null)
            : null,
      })),
    );
    return jsonOk({ uploads });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const current = await getCurrentUserOrGuest();
    if (!current) {
      return jsonError("Unauthorized", 401);
    }
    const { user } = current;
    const { id } = await context.params;
    const db = getDb();
    const classroom = await getClassroom(db, user.id, id);
    if (!classroom) {
      return jsonError("Not found", 404);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await countUploadsSince(db, user.id, since);
    if (user.isGuest && recentCount >= 1) {
      return jsonError("Guest preview is limited to 1 upload. Sign up to add more.", 403);
    }
    if (!user.isGuest && recentCount >= MAX_UPLOADS_PER_USER_PER_DAY) {
      return jsonError("Upload limit reached: 50 uploads per day", 429);
    }

    const isPaid = !user.isGuest && (await hasPaidPlan(db, user.id));
    const monthCount = isPaid
      ? 0
      : await countUploadsSince(db, user.id, startOfMonthAt(user.timezone));
    if (!isPaid && monthCount >= FREE_TIER.notesUploadsPerMonth) {
      return jsonError(FREE_UPLOAD_LIMIT, 403);
    }

    const contentType = request.headers.get("content-type") ?? "";
    const uploadIds: string[] = [];
    const scheduled: { uploadId: string; jobId: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData().catch(() => null);
      if (!formData) {
        return jsonError("Invalid form data", 400);
      }
      const files = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File);
      if (files.length < 1 || files.length > 10) {
        return jsonError("Attach between 1 and 10 images", 400);
      }
      if (user.isGuest && files.length > 1) {
        return jsonError("Guest preview is limited to 1 image. Sign up to add more.", 403);
      }
      if (!user.isGuest && recentCount + files.length > MAX_UPLOADS_PER_USER_PER_DAY) {
        return jsonError("Upload limit reached: 50 uploads per day", 429);
      }
      if (!isPaid && monthCount + files.length > FREE_TIER.notesUploadsPerMonth) {
        return jsonError(FREE_UPLOAD_LIMIT, 403);
      }
      const validated: { file: File; mimeType: string }[] = [];
      for (const file of files) {
        if (file.size > MAX_IMAGE_BYTES) {
          return jsonError(`${file.name || "Image"} is larger than 10MB`, 400);
        }
        const mimeType = resolveImageMime(file);
        if (!mimeType) {
          return jsonError(
            `${file.name || "Image"} must be a JPEG, PNG, WebP, GIF, AVIF, or HEIC image`,
            400,
          );
        }
        validated.push({ file, mimeType });
      }
      for (const { file, mimeType } of validated) {
        const key = `uploads/${id}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await putObject(key, bytes, mimeType);
        const upload = await createUpload(db, {
          classroomId: id,
          kind: "image",
          storageKey: key,
          originalFilename: file.name || null,
          mimeType,
          byteSize: file.size,
        });
        const job = await enqueueJob(db, { kind: "extract", payload: { uploadId: upload.id } });
        uploadIds.push(upload.id);
        scheduled.push({ uploadId: upload.id, jobId: job.id });
      }
    } else {
      const body = await readJson(request, textUploadSchema);
      const upload = await createUpload(db, {
        classroomId: id,
        kind: "text",
        textContent: body.text,
      });
      const job = await enqueueJob(db, { kind: "extract", payload: { uploadId: upload.id } });
      uploadIds.push(upload.id);
      scheduled.push({ uploadId: upload.id, jobId: job.id });
    }

    await extendClassroomActivity(db, user.id, classroom.autoStopDays, id);

    // Schedule real-time extraction in Next.js background via after()
    after(async () => {
      for (const item of scheduled) {
        await processUploadExtraction(item.uploadId, item.jobId).catch((err) =>
          console.error("[web-after] extraction failed", err),
        );
      }
    });

    return jsonOk({ uploadIds }, 202);
  } catch (error) {
    return handleRouteError(error);
  }
}
