import type { Upload } from "./queries";

function firstLine(value: string | null): string | null {
  const line = (value ?? "").split("\n").find((entry) => entry.trim() !== "");
  return line?.trim() ?? null;
}

/** The AI-written subject, else the first line of text or the file name. */
export function uploadTitle(upload: Upload, fallback: { text: string; image: string }): string {
  if (upload.subject) {
    return upload.subject;
  }
  return upload.kind === "image"
    ? (upload.originalFilename ?? fallback.image)
    : (firstLine(upload.textContent) ?? fallback.text);
}
