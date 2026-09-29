// Saves the payload today's quiz would send for a classroom, as a local eval case.
//
//   pnpm --filter worker eval:snapshot <classroomId> [name]
//
// Reads only. Cases land in .eval/cases, which git ignores, since they hold real notes.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { classrooms, createDbConnection, listKnowledgePointsForComposition } from "@tmr/db";
import { env } from "../env";
import { buildDailyCompositionInput } from "../handlers/compose";

async function main(): Promise<void> {
  const [classroomId, name] = process.argv.slice(2);
  if (!classroomId) {
    throw new Error("usage: eval:snapshot <classroomId> [name]");
  }
  const connection = createDbConnection(env.databaseUrl, 1);
  try {
    const [classroom] = await connection.db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId));
    if (!classroom) {
      throw new Error(`classroom ${classroomId} not found`);
    }
    const bank = await listKnowledgePointsForComposition(connection.db, classroom.id);
    if (bank.length === 0) {
      throw new Error(`classroom ${classroomId} has no knowledge points`);
    }
    const { payload } = await buildDailyCompositionInput(
      connection.db,
      classroom.userId,
      classroom,
      bank,
    );
    const dir = path.resolve(import.meta.dirname, "../../.eval/cases");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${name ?? `${classroom.targetLanguage}-${classroomId.slice(0, 8)}`}.json`);
    await writeFile(file, JSON.stringify(payload, null, 2));
    console.log(`[eval] saved ${payload.knowledgePoints.length} points to ${path.relative(process.cwd(), file)}`);
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error("[eval] snapshot failed", error);
  process.exitCode = 1;
});
