import { useParams } from "react-router";
import { ClassroomDangerZone } from "@/components/classroom/classroom-danger-zone";
import { ClassroomSettingsForm } from "@/components/classroom/classroom-settings-form";
import { DailyReviewsSettings } from "@/components/classroom/daily-reviews-settings";
import { QuizLengthSettings } from "@/components/classroom/quiz-length-settings";
import { FullPageSpinner } from "@/app/shell";
import { useClassroom } from "@/lib/queries";
import { isQuizLength } from "@tmr/core";

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
      <QuizLengthSettings
        classroomId={classroom.id}
        initialLength={isQuizLength(classroom.quizLength) ? classroom.quizLength : 0}
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
