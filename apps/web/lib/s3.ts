import { AwsClient } from "aws4fetch";
import { env } from "./env";

let client: AwsClient | null = null;

function s3Client(): AwsClient {
  if (!client) {
    if (!env.s3Bucket) {
      throw new Error("S3_BUCKET is required when STORAGE_PROVIDER=s3");
    }
    if (!env.s3AccessKeyId || !env.s3SecretAccessKey) {
      throw new Error(
        "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when STORAGE_PROVIDER=s3",
      );
    }
    client = new AwsClient({
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey,
      service: "s3",
      region: env.s3Region,
    });
  }
  return client;
}

function s3ObjectUrl(key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (env.s3Endpoint || env.s3ForcePathStyle) {
    // Path-style addressing (MinIO and other S3-compatible stores): endpoint/bucket/key.
    const base = (env.s3Endpoint || `https://s3.${env.s3Region}.amazonaws.com`).replace(
      /\/+$/,
      "",
    );
    return `${base}/${env.s3Bucket}/${encodedKey}`;
  }
  // Virtual-host addressing for AWS S3: bucket.s3.region.amazonaws.com/key.
  return `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${encodedKey}`;
}

// Sign with aws4fetch, send with the global fetch keeping the original Blob body.
// aws4fetch's fetch()/sign() expose the body as a ReadableStream, and under
// patched runtimes (Next.js) a streamed body loses its content length, which
// S3 rejects with 411. Passing the Blob directly keeps the request framed.
async function s3Fetch(
  url: string,
  init: RequestInit & { body?: Blob },
): Promise<Response> {
  const signed = await s3Client().sign(url, init);
  return fetch(signed.url, {
    method: signed.method,
    headers: signed.headers,
    body: init.body,
    signal: init.signal,
  });
}

export async function s3PutObject(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<void> {
  const body = new Blob([new Uint8Array(data)], { type: contentType });
  const response = await s3Fetch(s3ObjectUrl(key), {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });
  if (!response.ok) {
    throw new Error(`failed to put s3 object ${key} (${response.status})`);
  }
}

export async function s3GetObjectBytes(key: string): Promise<{
  bytes: Uint8Array;
  mimeType: string;
}> {
  const response = await s3Fetch(s3ObjectUrl(key), {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`failed to read s3 object ${key} (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    mimeType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
