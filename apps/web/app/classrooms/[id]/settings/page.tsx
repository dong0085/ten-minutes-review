import { notFound } from "next/navigation";
import { getClassroom } from "@tmr/db";
import { ClassroomDangerZone } from "@/components/classroom/classroom-danger-zone";
import { ClassroomSettingsForm } from "@/components/classroom/classroom-settings-form";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function ClassroomSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser({ allowGuest: true });
  const classroom = await getClassroom(getDb(), user.id, id);
  if (!classroom) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ClassroomSettingsForm
        classroom={{
          id: classroom.id,
          name: classroom.name,
          targetLanguage: classroom.targetLanguage,
          nativeLanguage: classroom.nativeLanguage,
          autoStopDays: classroom.autoStopDays,
        }}
      />
      <ClassroomDangerZone classroomId={classroom.id} />
    </div>
  );
}
