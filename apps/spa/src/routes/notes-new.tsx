import { useEffect } from "react";
import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { PageHeader } from "@/components/page";
import { UploadPanel } from "@/components/upload/upload-panel";
import { useSession } from "@/lib/session";

export function AddNotesPage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations("Classroom.UploadPage");
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // New notes change the counts on every classroom screen; refetch them on the way out.
  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: ["classroom", id] });
      void queryClient.invalidateQueries({ queryKey: ["classrooms"] });
    },
    [id, queryClient],
  );

  return (
    <div className="space-y-6">
      <PageHeader kicker={t("kicker")} title={t("title")} description={t("blurb")} />
      <UploadPanel classroomId={id} isGuest={session?.isGuest ?? false} />
    </div>
  );
}
