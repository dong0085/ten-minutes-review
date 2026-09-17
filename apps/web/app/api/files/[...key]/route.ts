import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserOrGuest } from "@/lib/session";
import { getObjectBytes } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  const current = await getCurrentUserOrGuest();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { key } = await context.params;
  const object = await getObjectBytes(key.join("/")).catch(() => null);
  if (!object) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(object.bytes), {
    headers: {
      "content-type": object.mimeType,
      "cache-control": "private, max-age=300",
    },
  });
}
