
import { useState } from "react";
import { useRouter } from "@/lib/router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Button } from "@tmr/ui/components/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@tmr/ui/components/alert-dialog";

export function DeleteQuizButton({
  quizId,
  onDeleted,
}: {
  quizId: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations("Classroom.QuizzesPage");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error(t("deleteError"));
        return;
      }
      router.refresh();
      onDeleted?.();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? t("deleting") : t("deleteQuiz")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void remove()}>
            {t("deleteQuiz")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
