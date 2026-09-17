"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function DailyReviewsSettings({
  classroomId,
  initiallyPaused,
}: {
  classroomId: string;
  initiallyPaused: boolean;
}) {
  const t = useTranslations("Classroom.DailyReviews");
  const router = useRouter();
  const [paused, setPaused] = useState(initiallyPaused);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      </CardContent>
    </Card>
  );
}
