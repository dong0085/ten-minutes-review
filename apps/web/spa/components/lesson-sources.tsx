import { Link } from "react-router";
import { useFormatter, useTranslations } from "use-intl";
import type { Quiz } from "@/spa/lib/queries";

/** Upload dates describe the saved notes, rather than assuming a lesson date. */
export function LessonSources({
  classroomId,
  sources,
}: {
  classroomId: string;
  sources: Quiz["sources"];
}) {
  const t = useTranslations("Quiz.Runner");
  const format = useFormatter();
  if (sources.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/70 bg-muted/25 p-4">
      <h2 className="text-sm font-semibold">{t("lessonSources")}</h2>
      <ul className="mt-2 space-y-2">
        {sources.map((source) => (
          <li key={source.id}>
            <Link
              to={`/classrooms/${classroomId}/notes/${source.id}`}
              className="block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {source.subject ? (
                <span className="block">{source.subject}</span>
              ) : null}
              <span className="text-xs">
                {t("sourceDate", {
                  date: format.dateTime(new Date(source.createdAt), {
                    dateStyle: "medium",
                  }),
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
