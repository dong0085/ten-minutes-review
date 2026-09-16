import { readFile } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserOrGuest } from "@/lib/session";
import { resolveLocalPath } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  const current = await getCurrentUserOrGuest();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { key } = await context.params;
  const target = resolveLocalPath(key.join("/"));
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const data = await readFile(target);
    const extension = target.slice(target.lastIndexOf(".")).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
