import { type ReactNode, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { Lightbulb, Loader2, MessageCircleQuestion, RotateCcw } from "lucide-react";
import { TUTOR_MAX_HINTS, type TutorAnalysis, type TutorHint } from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@tmr/ui/components/tooltip";
import { cn } from "@tmr/ui/utils";
import { ApiError, api } from "@/spa/lib/api";
import type { TutorNote } from "@/spa/lib/queries";
import type { LocalResponse } from "./types";

const POLL_MS = 2000;

/**
 * The AI tutor for a Corrections question. Its buttons join the question's own
 * row: before answering, a light bulb gives hints that get closer each time and
 * never give the answer; after a wrong answer, it can explain the mistake in
 * depth. Replies sit below on notes in the theme's ink, apart from the red pen.
 */
export function TutorPanel({
  classroomId,
  questionId,
  initial,
  wrongResponse,
  wrongAt,
  corrected,
  children,
}: {
  classroomId: string;
  questionId: string;
  initial: TutorNote[];
  /** The answer just marked wrong, which an analysis explains. */
  wrongResponse: LocalResponse | null;
  /** When that answer was marked, so an older analysis does not count for it. */
  wrongAt: string | null;
  corrected: boolean;
  /** The question's own actions, such as Check or Try again, which lead the row. */
  children?: ReactNode;
}) {
  const t = useTranslations("Classroom.Tutor");
  const [notes, setNotes] = useState<TutorNote[]>(initial);
  const [asking, setAsking] = useState<"hint" | "analysis" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingIds = notes.filter((note) => note.status === "pending").map((note) => note.id);
  const pendingKey = pendingIds.join();

  useEffect(() => {
    if (!pendingKey) {
      return;
    }
    const timer = window.setInterval(async () => {
      const updates = await Promise.all(
        pendingKey.split(",").map((id) =>
          api
            .get<{ request: TutorNote }>(`/api/tutor/${id}`)
            .then((data) => data.request)
            .catch(() => null),
        ),
      );
      setNotes((previous) =>
        previous.map((note) => updates.find((update) => update?.id === note.id) ?? note),
      );
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pendingKey]);

  const hints = notes.filter((note) => note.mode === "hint");
  const analyses = notes.filter((note) => note.mode === "analysis");
  const hintsUsed = hints.filter((note) => note.status !== "failed").length;
  const waiting = pendingIds.length > 0;
  // The newest analysis answers the latest wrong answer.
  const analysis = analyses.at(-1);

  async function ask(mode: "hint" | "analysis", replace?: string) {
    setAsking(mode);
    setError(null);
    try {
      const { request } = await api.post<{ request: TutorNote }>(
        `/api/classrooms/${classroomId}/mistakes/${questionId}/tutor`,
        mode === "analysis" ? { mode, response: wrongResponse ?? {} } : { mode },
      );
      setNotes((previous) => [
        ...previous.filter((note) => note.id !== request.id && note.id !== replace),
        request,
      ]);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("failed"));
    } finally {
      setAsking(null);
    }
  }

  const hintLabel = hintsUsed === 0 ? t("hint") : t("nextHint");
  const hintCount = t("hintCount", { used: hintsUsed, max: TUTOR_MAX_HINTS });
  const showHint = !corrected && !wrongResponse;
  const hintsLeft = TUTOR_MAX_HINTS - hintsUsed;
  const showAnalyze =
    !corrected &&
    !!wrongResponse &&
    (!analysis || (analysis.status !== "pending" && analysis.createdAt < (wrongAt ?? "")));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {children}
        {showHint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Spent hints keep the button focusable, so its tooltip still explains why. */}
              <Button
                size="sm"
                variant="outline"
                className={cn("gap-1.5 px-2.5 print:hidden", hintsLeft === 0 && "opacity-50")}
                aria-label={hintsLeft === 0 ? t("hintsUsed") : `${hintLabel} (${hintCount})`}
                aria-disabled={hintsLeft === 0}
                disabled={asking !== null || waiting}
                onClick={() => {
                  if (hintsLeft > 0) {
                    void ask("hint");
                  }
                }}
              >
                {asking === "hint" ? <Loader2 className="animate-spin" /> : <Lightbulb />}
                <span aria-hidden="true" className="flex gap-0.5">
                  {Array.from({ length: TUTOR_MAX_HINTS }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "size-1.5 rounded-full",
                        index < hintsLeft ? "bg-primary" : "bg-muted-foreground/25",
                      )}
                    />
                  ))}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hintsLeft === 0 ? (
                t("hintsUsed")
              ) : (
                <>
                  {hintLabel} <span className="tabular-nums opacity-70">{hintCount}</span>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {showAnalyze ? (
          <Button
            size="sm"
            variant="outline"
            className="print:hidden"
            disabled={asking !== null}
            onClick={() => void ask("analysis")}
          >
            {asking === "analysis" ? <Loader2 className="animate-spin" /> : <MessageCircleQuestion />}
            {t("analyze")}
          </Button>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {notes.length > 0 ? (
        <div className="tutor-panel space-y-2 print:hidden" aria-live="polite">
          {hints.length > 0 ? (
            <ol className="space-y-2">
              {hints.map((note) => (
                <li key={note.id} className="tutor-note">
                  <p className="flex items-center gap-1 text-[0.7rem] font-semibold text-primary">
                    <Lightbulb aria-hidden="true" className="size-3" />
                    <span aria-hidden="true" className="tabular-nums">
                      {note.level}
                    </span>
                    <span className="sr-only">{t("hintTitle", { level: note.level })}</span>
                  </p>
                  <NoteBody note={note} onRetry={() => void ask("hint", note.id)} />
                </li>
              ))}
            </ol>
          ) : null}
          {analysis ? (
            <div className="tutor-note">
              <p className="text-[0.7rem] font-semibold text-primary">{t("analysisTitle")}</p>
              <NoteBody note={analysis} onRetry={() => void ask("analysis", analysis.id)} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NoteBody({ note, onRetry }: { note: TutorNote; onRetry: () => void }) {
  const t = useTranslations("Classroom.Tutor");
  if (note.status === "pending") {
    return (
      <p role="status" className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        {t("thinking")}
      </p>
    );
  }
  if (note.status === "failed" || !note.content) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {t("failed")}
        <Button size="xs" variant="ghost" onClick={onRetry}>
          <RotateCcw />
          {t("askAgain")}
        </Button>
      </p>
    );
  }
  if ("hint" in note.content) {
    return <p className="mt-1 text-sm leading-relaxed">{(note.content as TutorHint).hint}</p>;
  }
  const analysis = note.content as TutorAnalysis;
  return (
    <div className="mt-1 space-y-2.5 text-sm leading-relaxed">
      <p>{analysis.diagnosis}</p>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{t("rule")}</p>
        <p>{analysis.rule}</p>
      </div>
      {analysis.examples.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{t("examples")}</p>
          <ul className="space-y-1">
            {analysis.examples.map((example, index) => (
              <li key={index}>
                <span className="font-heading italic">{example.target}</span>
                {example.translation ? (
                  <span className="text-muted-foreground"> — {example.translation}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {analysis.tip ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{t("tip")}</p>
          <p>{analysis.tip}</p>
        </div>
      ) : null}
    </div>
  );
}
