import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useFormatter, useTranslations } from "use-intl";
import { Loader2, Pencil, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@tmr/ui/components/alert";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Label } from "@tmr/ui/components/label";
import { Textarea } from "@tmr/ui/components/textarea";
import { BillingButton } from "@/spa/components/account/billing-button";
import { PageHeader, SectionTitle } from "@/spa/components/page";
import { UploadStatusBadge } from "@/spa/components/upload-status";
import { FullPageSpinner } from "@/spa/app/shell";
import { ApiError, isNotFound } from "@/spa/lib/api";
import { useDiscardReread, useEditNote, useRereadNote } from "@/spa/lib/note-actions";
import { isRereading, useNote, type NoteDetail } from "@/spa/lib/queries";
import { useSession } from "@/spa/lib/session";
import { uploadTitle } from "@/spa/lib/uploads";
import { NotFoundPage } from "./not-found";

function errorOf(error: unknown): { message: string; proRequired: boolean } | null {
  if (!error) {
    return null;
  }
  const code =
    error instanceof ApiError && error.body && typeof error.body === "object" && "code" in error.body
      ? error.body.code
      : null;
  return { message: error instanceof Error ? error.message : String(error), proRequired: code === "pro_required" };
}

/**
 * One upload in full: the original text or image, the points it gave, and the
 * way to fix it. Editing typed notes reads only the changed lines again; points
 * on untouched lines keep their wording, history, and omits.
 */
export function NoteDetailPage() {
  const { id, uploadId } = useParams() as { id: string; uploadId: string };
  const { data, isPending, error } = useNote(id, uploadId);

  if (isPending) {
    return <FullPageSpinner />;
  }
  if (!data || isNotFound(error)) {
    return <NotFoundPage />;
  }
  return <NoteDetail classroomId={id} note={data} />;
}

function NoteDetail({ classroomId, note }: { classroomId: string; note: NoteDetail }) {
  const t = useTranslations("Classroom.HistoryPage");
  const format = useFormatter();
  const { data: session } = useSession();
  const { upload, points, rereadsLeft } = note;
  const [editing, setEditing] = useState(false);
  const edit = useEditNote(classroomId, upload.id);
  const reread = useRereadNote(classroomId, upload.id);
  const discard = useDiscardReread(classroomId, upload.id);

  const rereading = isRereading(upload);
  const rereadFailed = upload.reread?.status === "failed";
  const ready = upload.extractionStatus === "done";
  const busy = rereading || edit.isPending || reread.isPending || discard.isPending;
  const outOfRereads = rereadsLeft === 0;
  const actionError = errorOf(edit.error ?? reread.error ?? discard.error);
  const shownText = rereading ? (upload.reread?.pendingText ?? upload.textContent) : upload.textContent;
  const kicker = [
    format.dateTime(new Date(upload.createdAt), { dateStyle: "medium", timeStyle: "short" }),
    upload.kind === "image" ? t("image") : t("textNotes"),
    upload.editedAt
      ? t("editedOn", { date: format.dateTime(new Date(upload.editedAt), { dateStyle: "medium" }) })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker={kicker}
        title={uploadTitle(upload, { text: t("textNotes"), image: t("image") })}
        actions={<UploadStatusBadge upload={upload} />}
      />

      {rereading ? (
        <Alert>
          <Loader2 className="animate-spin" />
          <AlertTitle>{t("rereading")}</AlertTitle>
          <AlertDescription>{t("rereadingBlurb")}</AlertDescription>
        </Alert>
      ) : null}

      {rereadFailed ? (
        <Alert variant="destructive">
          <AlertTitle>{t("rereadFailed")}</AlertTitle>
          <AlertDescription>
            <p>{t("rereadFailedBlurb")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => reread.mutate()}>
                {t("tryAgain")}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => discard.mutate()}>
                {t("discardEdit")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {upload.extractionStatus === "failed" ? (
        <Alert variant="destructive">
          <AlertTitle>{t("readFailed")}</AlertTitle>
          <AlertDescription>
            {upload.extractionError ? <p>{upload.extractionError}</p> : null}
            <div className="mt-3">
              <Button size="sm" disabled={busy} onClick={() => reread.mutate()}>
                {t("tryAgain")}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant={actionError.proRequired ? "default" : "destructive"}>
          <AlertDescription>
            <p>{actionError.message}</p>
            {actionError.proRequired && session?.features.billing ? (
              <div className="mt-3">
                <BillingButton action="checkout" />
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {upload.imageUrl ? (
        <img
          src={upload.imageUrl}
          alt={upload.originalFilename ?? t("imageAlt")}
          className="max-h-[70vh] w-full rounded-2xl border border-border object-contain"
        />
      ) : editing ? (
        <EditNoteForm
          initialText={upload.textContent ?? ""}
          saving={edit.isPending}
          onCancel={() => {
            edit.reset();
            setEditing(false);
          }}
          onSave={(text) => edit.mutate(text, { onSuccess: () => setEditing(false) })}
        />
      ) : (
        <div className="editorial-surface paper-lines rounded-2xl px-6 py-6 sm:px-8">
          <p className="text-sm leading-7 whitespace-pre-wrap">{shownText}</p>
        </div>
      )}

      {!editing && ready && !rereading ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {upload.kind === "text" ? (
              <Button
                variant="outline"
                disabled={busy || outOfRereads}
                onClick={() => {
                  reread.reset();
                  discard.reset();
                  setEditing(true);
                }}
              >
                <Pencil />
                {t("edit")}
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={busy || outOfRereads}
              title={t("rereadHint")}
              onClick={() => {
                edit.reset();
                reread.mutate();
              }}
            >
              {reread.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              {t("reread")}
            </Button>
            <Button asChild variant="ghost">
              <Link to={`/classrooms/${classroomId}?create=1`}>{t("practise")}</Link>
            </Button>
          </div>
          {rereadsLeft !== null ? (
            <p className="text-xs text-muted-foreground">{t("rereadsLeft", { count: rereadsLeft })}</p>
          ) : null}
        </div>
      ) : null}

      {upload.discardedCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("skippedDetail", { count: upload.discardedCount })}
        </p>
      ) : null}

      {upload.rereadResult && !rereading ? (
        <p className="text-sm text-muted-foreground">
          {t("resultSummary", {
            updated: upload.rereadResult.updated,
            added: upload.rereadResult.added,
            removed: upload.rereadResult.removed,
          })}
          {upload.rereadResult.keptEditedPointIds.length > 0
            ? ` ${t("keptEdited", { count: upload.rereadResult.keptEditedPointIds.length })}`
            : null}
        </p>
      ) : null}

      {ready ? <NotePoints classroomId={classroomId} points={points} /> : null}
    </div>
  );
}

function EditNoteForm({
  initialText,
  saving,
  onSave,
  onCancel,
}: {
  initialText: string;
  saving: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("Classroom.HistoryPage");
  const [text, setText] = useState(initialText);
  const changed = text.trim() !== "" && text.trim() !== initialText.trim();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (changed) {
      onSave(text);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Label htmlFor="note-text">{t("editLabel")}</Label>
      <p className="text-sm text-muted-foreground">{t("editHint")}</p>
      <Textarea
        id="note-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={Math.min(24, Math.max(8, text.split("\n").length + 1))}
        className="font-mono text-sm leading-7"
        autoFocus
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!changed || saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function NotePoints({ classroomId, points }: { classroomId: string; points: NoteDetail["points"] }) {
  const t = useTranslations("Classroom.HistoryPage");
  const bankT = useTranslations("Classroom.BankPage");
  const categoryT = useTranslations("Category");

  return (
    <section className="space-y-3">
      <SectionTitle>{t("pointsTitle", { count: points.length })}</SectionTitle>
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pointsEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border/70 rounded-2xl border border-border/70">
          {points.map((point) => (
            <li key={point.id}>
              <Link
                to={`/classrooms/${classroomId}/bank/${point.id}`}
                className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm hover:bg-muted/40"
              >
                <Badge variant="secondary">{categoryT(point.category)}</Badge>
                <span className={point.isRetired ? "opacity-60" : undefined}>
                  <span className="font-medium">{point.targetText}</span>
                  {point.nativeText ? (
                    <span className="text-muted-foreground"> — {point.nativeText}</span>
                  ) : null}
                </span>
                {point.isRetired ? <Badge variant="outline">{bankT("omittedBadge")}</Badge> : null}
                {point.userEdited ? <Badge variant="outline">{t("editedBadge")}</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
