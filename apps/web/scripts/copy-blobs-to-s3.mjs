// One-time copy of uploaded note images from Vercel Blob to S3, keeping each key.
// uploads.storage_key holds the same relative key for both stores, so no rows change.
// Safe to re-run: every object is written again with the same bytes.
//
// Run from apps/web:
//   BLOB_READ_WRITE_TOKEN=… S3_BUCKET=… S3_REGION=… S3_ACCESS_KEY_ID=… S3_SECRET_ACCESS_KEY=… \
//     node scripts/copy-blobs-to-s3.mjs [--dry-run]
import { list } from "@vercel/blob";
import { AwsClient } from "aws4fetch";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const dryRun = process.argv.includes("--dry-run");
const token = required("BLOB_READ_WRITE_TOKEN");
const bucket = required("S3_BUCKET");
const region = required("S3_REGION");
const s3 = new AwsClient({
  accessKeyId: required("S3_ACCESS_KEY_ID"),
  secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  service: "s3",
  region,
});

let copied = 0;
let skipped = 0;
let bytes = 0;
let cursor;

do {
  const page = await list({ cursor, token, limit: 1000 });
  for (const blob of page.blobs) {
    const key = blob.pathname.replace(/^\/+/, "");
    if (!key.startsWith("uploads/")) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`would copy ${key} (${blob.size} bytes)`);
      copied += 1;
      bytes += blob.size;
      continue;
    }

    const source = await fetch(blob.url);
    if (!source.ok) {
      throw new Error(`failed to read ${key} from Vercel Blob (${source.status})`);
    }
    const contentType = source.headers.get("content-type") ?? "application/octet-stream";
    const body = new Uint8Array(await source.arrayBuffer());

    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const target = await s3.fetch(`https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`, {
      method: "PUT",
      headers: { "content-type": contentType },
      body,
    });
    if (!target.ok) {
      throw new Error(`failed to write ${key} to S3 (${target.status}): ${await target.text()}`);
    }

    copied += 1;
    bytes += body.byteLength;
    console.log(`copied ${key}`);
  }
  cursor = page.cursor;
} while (cursor);

const verb = dryRun ? "would copy" : "copied";
console.log(`${verb} ${copied} objects (${(bytes / 1024 / 1024).toFixed(1)} MB), skipped ${skipped}`);
