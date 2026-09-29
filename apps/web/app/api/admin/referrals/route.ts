import { listReferralsForAdmin } from "@tmr/db";
import { jsonOk } from "@/lib/api";
import { adminRoute } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = adminRoute(async () => jsonOk(await listReferralsForAdmin(getDb())));
