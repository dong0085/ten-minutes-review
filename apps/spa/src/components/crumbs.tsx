import { useLocale, useTranslations } from "use-intl";
import { formatQuizDate } from "@/lib/format";
import { useBank, useClassroom, useQuiz, useUploads } from "@/lib/queries";
import { uploadTitle } from "@/lib/uploads";

// Breadcrumb labels. Each reads from a query the screen below already loads,
// so the trail fills in from the cache without extra requests.

export function Label({ k }: { k: Parameters<ReturnType<typeof useTranslations<"App.Crumbs">>>[0] }) {
  const t = useTranslations("App.Crumbs");
  return <>{t(k)}</>;
}

export function ClassroomName({ id }: { id: string }) {
  const { data } = useClassroom(id);
  return <>{data?.name ?? "…"}</>;
}

export function QuizName({ quizId }: { quizId: string }) {
  const locale = useLocale();
  const { data } = useQuiz(quizId);
  return <>{data ? formatQuizDate(data.quiz.quizDate, locale) : "…"}</>;
}

export function PointName({ classroomId, pointId }: { classroomId: string; pointId: string }) {
  const { data } = useBank(classroomId);
  return <>{data?.find((point) => point.id === pointId)?.targetText ?? "…"}</>;
}

export function UploadName({ classroomId, uploadId }: { classroomId: string; uploadId: string }) {
  const t = useTranslations("Classroom.HistoryPage");
  const { data } = useUploads(classroomId);
  const upload = data?.find((entry) => entry.id === uploadId);
  return <>{upload ? uploadTitle(upload, { text: t("textNotes"), image: t("image") }) : "…"}</>;
}
