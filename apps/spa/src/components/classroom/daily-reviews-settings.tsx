
import { useState } from "react";
import { useRouter } from "@/lib/router";
import { useTranslations } from "use-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import { Separator } from "@tmr/ui/components/separator";

export function DailyReviewsSettings({
  classroomId,
  initiallyPaused,
  initiallyIncludeAnswers,
}: {
  classroomId: string;
  initiallyPaused: boolean;
  initiallyIncludeAnswers: boolean;
}) {
  const t = useTranslations("Classroom.DailyReviews");
  const router = useRouter();
  const [paused, setPaused] = useState(initiallyPaused);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeAnswers, setIncludeAnswers] = useState(initiallyIncludeAnswers);
  const [answersPending, setAnswersPending] = useState(false);
  const [answersError, setAnswersError] = useState<string | null>(null);

  async function togglePaused() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: !paused }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("error"));
        return;
      }
      const body = (await response.json()) as { classroom: { pausedAt: string | null } };
      setPaused(body.classroom.pausedAt !== null);
      router.refresh();
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }

  async function toggleIncludeAnswers(checked: boolean) {
    setAnswersPending(true);
    setAnswersError(null);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ includeAnswersInEmail: checked }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setIncludeAnswers(!checked);
        setAnswersError(body?.error ?? t("error"));
        return;
      }
      const body = (await response.json()) as {
        classroom: { includeAnswersInEmail: boolean };
      };
      setIncludeAnswers(body.classroom.includeAnswersInEmail);
    } catch {
      setIncludeAnswers(!checked);
      setAnswersError(t("error"));
    } finally {
      setAnswersPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.025em]">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {paused ? t("pausedExplanation") : t("activeExplanation")}
          </p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="button"
          variant={paused ? "default" : "outline"}
          disabled={pending}
          onClick={togglePaused}
        >
          {pending
            ? paused
              ? t("resuming")
              : t("pausing")
            : paused
              ? t("resume")
              : t("pause")}
        </Button>
        <Separator />
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={includeAnswers}
            disabled={answersPending}
            onChange={(event) => toggleIncludeAnswers(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>{t("includeAnswers")}</span>
        </label>
        <p className="text-sm leading-6 text-muted-foreground">{t("includeAnswersHelp")}</p>
        {answersError ? (
          <Alert variant="destructive">
            <AlertDescription>{answersError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
