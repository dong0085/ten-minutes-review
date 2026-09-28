import type { TutorRequest } from "@tmr/db";

// A worker that died mid-reply leaves the request pending; after this long the page offers to ask again.
const STALE_MS = 5 * 60 * 1000;

export function tutorPayload(request: TutorRequest) {
  const stale =
    request.status === "pending" && Date.now() - request.createdAt.getTime() > STALE_MS;
  return {
    id: request.id,
    questionId: request.questionId,
    mode: request.mode,
    level: request.level,
    status: stale ? ("failed" as const) : request.status,
    content: request.status === "done" ? request.content : null,
    createdAt: request.createdAt,
  };
}
