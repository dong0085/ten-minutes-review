import { useParams } from "react-router";
import { useFormatter, useTranslations } from "use-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { PageHeader } from "@/components/page";
import { UploadStatusBadge } from "@/components/upload-status";
import { FullPageSpinner } from "@/app/shell";
import { useUploads } from "@/lib/queries";
import { uploadTitle } from "@/lib/uploads";
import { NotFoundPage } from "./not-found";

/** One upload in full: the original text or image, as the learner fed it in. */
export function NoteDetailPage() {
  const { id, uploadId } = useParams() as { id: string; uploadId: string };
  const t = useTranslations("Classroom.HistoryPage");
  const format = useFormatter();
  const { data: uploads, isPending } = useUploads(id);

  if (isPending) {
    return <FullPageSpinner />;
  }
  const upload = uploads?.find((entry) => entry.id === uploadId);
  if (!upload) {
    return <NotFoundPage />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker={`${format.dateTime(new Date(upload.createdAt), {
          dateStyle: "medium",
          timeStyle: "short",
        })} · ${upload.kind === "image" ? t("image") : t("textNotes")}`}
        title={uploadTitle(upload, { text: t("textNotes"), image: t("image") })}
        actions={<UploadStatusBadge status={upload.extractionStatus} />}
      />
      {upload.imageUrl ? (
        <img
          src={upload.imageUrl}
          alt={upload.originalFilename ?? t("imageAlt")}
          className="max-h-[70vh] w-full rounded-2xl border border-border object-contain"
        />
      ) : (
        <div className="editorial-surface paper-lines rounded-2xl px-6 py-6 sm:px-8">
          <p className="text-sm leading-7 whitespace-pre-wrap">{upload.textContent}</p>
        </div>
      )}
      {upload.discardedCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("skippedDetail", { count: upload.discardedCount })}
        </p>
      ) : null}
      {upload.extractionError ? (
        <Alert variant="destructive">
          <AlertDescription>{upload.extractionError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
