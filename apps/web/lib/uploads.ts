import type { NoteRereadResult } from "@tmr/core";
import type { Upload } from "@tmr/db";
import { objectUrl } from "./storage";

export type UploadJson = {
  id: string;
  kind: Upload["kind"];
  textContent: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  byteSize: number | null;
  extractionStatus: Upload["extractionStatus"];
  extractedAt: Date | null;
  extractionError: string | null;
  subject: string | null;
  discardedCount: number;
  createdAt: Date;
  editedAt: Date | null;
  imageUrl: string | null;
  /** A re-read waiting, running, or failed; null when there is none. */
  reread: {
    status: "pending" | "running" | "failed";
    error: string | null;
    pendingText: string | null;
  } | null;
  rereadResult: NoteRereadResult | null;
  rereadCount: number;
};

export async function toUploadJson(upload: Upload): Promise<UploadJson> {
  return {
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
    editedAt: upload.editedAt,
    imageUrl:
      upload.kind === "image" && upload.storageKey
        ? await objectUrl(upload.storageKey).catch(() => null)
        : null,
    reread: upload.rereadStatus
      ? { status: upload.rereadStatus, error: upload.rereadError, pendingText: upload.pendingText }
      : null,
    rereadResult: upload.rereadResult,
    rereadCount: upload.rereadCount,
  };
}
