import { getClassroomAdminDetail } from "@tmr/db";
import { jsonError, jsonOk } from "@/lib/api";
import { adminRoute, audit } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute<{ id: string }>(async ({ admin, params }) => {
  const detail = await getClassroomAdminDetail(getDb(), params.id);
  if (!detail) {
    return jsonError("Not found", 404);
  }
  await audit(admin, "view_user_content", { type: "user", id: detail.classroom.userId }, {
    classroomId: params.id,
  });
  return jsonOk(detail);
});
