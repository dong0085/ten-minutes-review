import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { head, put } from "@vercel/blob";
import { env } from "./env";
import { s3GetObjectBytes, s3PutObject } from "./s3";

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "../..", ".uploads");

export type StoredFile = { key: string; url: string };

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

export async function putObject(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<StoredFile> {
  if (env.storageProvider === "vercel") {
    const blob = await put(key, Buffer.from(data), {
      access: "public",
      contentType,
      token: env.blobReadWriteToken || undefined,
    });
    return { key: blob.pathname || key, url: blob.url };
  }
  if (env.storageProvider === "s3") {
    await s3PutObject(key, data, contentType);
    return { key, url: `/api/files/${key}` };
  }
  const target = path.join(LOCAL_UPLOAD_DIR, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return { key, url: `/api/files/${key}` };
}

export async function objectUrl(key: string): Promise<string> {
  if (env.storageProvider === "vercel") {
    const blob = await head(key, { token: env.blobReadWriteToken || undefined });
    return blob.url;
  }
  // local and s3 serve through the authed /api/files route.
  return `/api/files/${key}`;
}

export function resolveLocalPath(key: string): string | null {
  const target = path.resolve(LOCAL_UPLOAD_DIR, key);
  if (!target.startsWith(`${LOCAL_UPLOAD_DIR}${path.sep}`)) {
    return null;
  }
  return target;
}

export async function getObjectBytes(
  key: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (env.storageProvider === "vercel") {
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
