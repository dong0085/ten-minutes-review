import { useParams } from "react-router";
import { ClassroomDangerZone } from "@/components/classroom/classroom-danger-zone";
import { ClassroomSettingsForm } from "@/components/classroom/classroom-settings-form";
import { DailyReviewsSettings } from "@/components/classroom/daily-reviews-settings";
import { FullPageSpinner } from "@/app/shell";
import { useClassroom } from "@/lib/queries";

export function ClassroomSettingsPage() {
  const { id } = useParams() as { id: string };
  const { data: classroom } = useClassroom(id);
  if (!classroom) {
    return <FullPageSpinner />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ClassroomSettingsForm
        key={classroom.id}
        classroom={{
          id: classroom.id,
          name: classroom.name,
          targetLanguage: classroom.targetLanguage,
          nativeLanguage: classroom.nativeLanguage,
          autoStopDays: classroom.autoStopDays,
        }}
      />
      <DailyReviewsSettings
        classroomId={classroom.id}
        initiallyPaused={classroom.pausedAt !== null}
        initiallyIncludeAnswers={classroom.includeAnswersInEmail}
      />
      <ClassroomDangerZone classroomId={classroom.id} />
    </div>
  );
}
