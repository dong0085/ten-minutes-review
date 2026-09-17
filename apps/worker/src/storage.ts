import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { s3GetObjectBytes } from "./s3";

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "../..", ".uploads");

export type ObjectBytes = {
  bytes: Uint8Array;
  mimeType: string;
};

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
};

export function mimeTypeForKey(key: string): string {
  const extension = path.extname(key).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

export function resolveLocalPath(key: string): string | null {
  if (!key) {
    return null;
  }
  const target = path.resolve(LOCAL_UPLOAD_DIR, key);
  if (!target.startsWith(`${LOCAL_UPLOAD_DIR}${path.sep}`)) {
    return null;
  }
  return target;
}

export async function getObjectBytes(key: string): Promise<ObjectBytes> {
  if (env.storageProvider === "vercel") {
    // TODO: use head() from @vercel/blob once that package is a direct dependency of the worker.
    const url = /^https?:\/\//.test(key) ? key : `https://blob.vercel-storage.com/${key}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(60_000),
      headers: env.blobReadWriteToken
        ? { authorization: `Bearer ${env.blobReadWriteToken}` }
        : undefined,
    });
    if (!response.ok) {
      throw new Error(`failed to read blob ${key} (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      bytes,
      mimeType: response.headers.get("content-type") ?? mimeTypeForKey(key),
    };
  }

  if (env.storageProvider === "s3") {
    return s3GetObjectBytes(key);
  }

  const target = resolveLocalPath(key);
  if (!target) {
    throw new Error(`invalid storage key: ${key}`);
  }
  const bytes = new Uint8Array(await readFile(target));
  return { bytes, mimeType: mimeTypeForKey(key) };
}
