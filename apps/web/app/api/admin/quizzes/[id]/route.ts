import { getQuizAdminDetail } from "@tmr/db";
import { jsonError, jsonOk } from "@/lib/api";
import { adminRoute, audit } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute<{ id: string }>(async ({ admin, params }) => {
  const detail = await getQuizAdminDetail(getDb(), params.id);
  if (!detail) {
    return jsonError("Not found", 404);
  }
  await audit(admin, "view_user_content", { type: "user", id: String(detail.quiz.user_id) }, {
    quizId: params.id,
  });
  return jsonOk(detail);
});
