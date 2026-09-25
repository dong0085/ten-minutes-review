
import { useState } from "react";
import { useRouter } from "@/lib/router";
import { useTranslations } from "use-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";

export function ClassroomDangerZone({ classroomId }: { classroomId: string }) {
  const t = useTranslations("Classroom.DangerZone");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"archive" | "delete" | null>(null);

  async function archive() {
    if (!window.confirm(t("archiveConfirm"))) {
      return;
    }
    setPending("archive");
    setError(null);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/archive`, {
        method: "POST",
      });
      if (!response.ok) {
        setError(t("archiveError"));
        return;
      }
      router.push("/classrooms");
      router.refresh();
    } catch {
      setError(t("archiveError"));
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    const confirmed = window.confirm(t("deleteConfirm"));
    if (!confirmed) {
      return;
    }
    setPending("delete");
    setError(null);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(t("deleteError"));
        return;
      }
      router.push("/classrooms");
      router.refresh();
    } catch {
      setError(t("deleteError"));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.025em]">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("blurb")}</p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={pending !== null} onClick={() => void archive()}>
            {pending === "archive" ? t("archiving") : t("archive")}
          </Button>
          <Button variant="destructive" disabled={pending !== null} onClick={() => void remove()}>
            {pending === "delete" ? t("deleting") : t("delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
