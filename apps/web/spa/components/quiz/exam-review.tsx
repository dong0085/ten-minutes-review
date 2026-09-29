import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import { cn } from "@tmr/ui/utils";
import { api } from "@/spa/lib/api";
import { keys, useAttemptReview, type AttemptReviewState } from "@/spa/lib/queries";

/**
 * The AI's read on an exam's mistakes, clipped to the top of the graded paper
 * like a teacher's comment slip. The red-pen notes on each question stay where
 * they are; this panel is the view across all of them.
 */
export function ExamReviewPanel({
  attemptId,
  initiallyWriting = false,
  onJump,
  className,
}: {
  attemptId: string;
  /** Set right after submit, so the panel shows "writing" before the first poll lands. */
  initiallyWriting?: boolean;
  onJump?: (number: number) => void;
  className?: string;
}) {
  const t = useTranslations("Quiz.ExamReview");
  const queryClient = useQueryClient();
  const { data } = useAttemptReview(attemptId);
  const [retrying, setRetrying] = useState(false);
  const status = data?.status ?? (initiallyWriting ? "writing" : "none");

  if (status === "none") {
    return null;
  }

  async function retry() {
    setRetrying(true);
    try {
      const next = await api.post<AttemptReviewState>(`/api/attempts/${attemptId}/review`);
      queryClient.setQueryData(keys.attemptReview(attemptId), next);
    } catch {
      // The panel keeps showing the failure, with the button to try again.
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section
      aria-labelledby={`exam-review-${attemptId}`}
      aria-busy={status === "writing"}
      className={cn("exam-review-slip print:break-inside-avoid", className)}
    >
      <header className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="size-4 text-primary" />
        <h3 id={`exam-review-${attemptId}`} className="font-heading text-lg font-semibold">
          {t("title")}
        </h3>
      </header>

      {status === "writing" ? (
        <div role="status" className="mt-3 space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("writing")}
          </p>
          <div aria-hidden="true" className="space-y-2">
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
          <p className="text-xs text-muted-foreground">{t("writingHint")}</p>
        </div>
      ) : status === "failed" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{t("failed")}</p>
          <Button variant="outline" size="sm" disabled={retrying} onClick={() => void retry()}>
            {retrying ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            {t("retry")}
          </Button>
        </div>
      ) : data?.review ? (
        <div className="mt-3 space-y-5 motion-safe:animate-in motion-safe:fade-in">
          <p className="text-[0.95rem] leading-relaxed">{data.review.overview}</p>

          <div>
            <p className="eyebrow">{t("patterns")}</p>
            <ol className="mt-2 space-y-4">
              {data.review.patterns.map((pattern, index) => (
                <li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
                  <span
                    aria-hidden="true"
                    className="font-heading text-lg leading-6 font-semibold text-destructive tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-1.5">
                    <p className="font-medium leading-6">{pattern.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{pattern.detail}</p>
                    {pattern.questions.length > 0 ? (
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {t("questions")}
                        {pattern.questions.map((number) =>
                          onJump ? (
                            <button
                              key={number}
                              type="button"
                              aria-label={t("jump", { number })}
                              onClick={() => onJump(number)}
                              className="exam-review-chip"
                            >
                              {number}
                            </button>
                          ) : (
                            <span key={number} className="exam-review-chip">
                              {number}
                            </span>
                          ),
                        )}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {data.review.nextSteps.length > 0 ? (
            <div>
              <p className="eyebrow">{t("nextSteps")}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {data.review.nextSteps.map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span aria-hidden="true" className="text-primary">
                      →
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
            {t("note")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
