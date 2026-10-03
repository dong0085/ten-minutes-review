import { Link } from "react-router";
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "use-intl";
import {
  ArrowRight,
  FileText,
  ImagePlus,
  Loader2,
  Lock,
  UploadCloud,
  X,
} from "lucide-react";
import { MAX_IMAGE_BYTES } from "@tmr/core";
import { PEEK_SPRING } from "@/spa/lib/use-peek";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tmr/ui/components/dialog";
import { Label } from "@tmr/ui/components/label";
import { Textarea } from "@tmr/ui/components/textarea";
import { BillingButton } from "@/spa/components/account/billing-button";
import { keys, useBank, useClassrooms } from "@/spa/lib/queries";
import { readApiError } from "@/spa/lib/read-error";
import { NotesPreviewDialog } from "./notes-preview-dialog";
import { useSession } from "@/spa/lib/session";

const MAX_FILES = 10;

/** The free weekly allowance ran out; the API answered with `pro_required`. */
class UploadLimitError extends Error {}

async function uploadFailure(
  response: Response,
  fallback: string,
): Promise<Error> {
  const { message, code } = await readApiError(response);
  return code === "pro_required"
    ? new UploadLimitError(message ?? fallback)
    : new Error(message ?? fallback);
}

/** Shown in place of the form once a free account has used this week's upload. */
function UploadLimitCard({ resetsAt }: { resetsAt: string | null }) {
  const t = useTranslations("Upload.Panel");
  const format = useFormatter();
  const { data: session } = useSession();

  return (
    <Card className="bg-card/75">
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary">
            <Lock className="size-4" />
          </span>
          <div className="space-y-1.5">
            <p className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold">
              {t("limitTitle")}
              <Badge>Pro</Badge>
            </p>
            <p className="text-sm text-muted-foreground">{t("limitBody")}</p>
            {resetsAt ? (
              <p className="text-xs text-muted-foreground">
                {t("limitNext", {
                  date: format.dateTime(new Date(resetsAt), {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  }),
                })}
              </p>
            ) : null}
          </div>
        </div>
        {session?.features.billing ? <BillingButton action="checkout" /> : null}
      </CardContent>
    </Card>
  );
}

type ExtractionStatus = "pending" | "running" | "done" | "failed";

type UploadRow = {
  id: string;
  kind: "text" | "image";
  textContent: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  byteSize: number | null;
  extractionStatus: ExtractionStatus;
  extractedAt: string | null;
  extractionError: string | null;
  subject: string | null;
  discardedCount: number;
  createdAt: string;
  imageUrl: string | null;
};

function firstLine(value: string | null, fallback: string): string {
  const line = (value ?? "").split("\n").find((entry) => entry.trim() !== "");
  return line?.trim() ?? fallback;
}

function StatusBadge({ status }: { status: ExtractionStatus }) {
  const t = useTranslations("Upload.Panel");
  if (status === "done") {
    return <Badge variant="success">{t("processed")}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive">{t("failed")}</Badge>;
  }
  if (status === "running") {
    return <Badge variant="warning">{t("reading")}</Badge>;
  }
  return <Badge variant="warning">{t("queued")}</Badge>;
}

function SelectedFilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const t = useTranslations("Upload.Panel");

  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      transition={PEEK_SPRING}
      className="group relative overflow-hidden rounded-xl border border-border/70 bg-card"
    >
      <div className="paper-lines grid h-24 place-items-center bg-primary/[0.035]">
        <span className="grid size-9 place-items-center rounded-xl bg-card text-primary shadow-sm">
          <ImagePlus className="size-4" />
        </span>
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
        <button
          type="button"
          onClick={onRemove}
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          aria-label={`${t("remove")} ${file.name}`}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.li>
  );
}

export function UploadPanel({
  classroomId,
  isGuest = false,
}: {
  classroomId: string;
  isGuest?: boolean;
}) {
  const t = useTranslations("Upload.Panel");
  const tCommon = useTranslations("Common");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [bankBefore, setBankBefore] = useState<number | null>(null);
  const [bankAfter, setBankAfter] = useState<number | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const queryClient = useQueryClient();
  // Free accounts get `limits`; paid accounts and guests get null.
  const { data: classroomList } = useClassrooms(!isGuest);
  const limits = classroomList?.limits ?? null;
  const outOfUploads =
    limitReached ||
    (limits !== null && limits.uploadsThisWeek >= limits.uploadsPerWeek);

  const loadUploads = useCallback(async () => {
    const response = await fetch(`/api/classrooms/${classroomId}/uploads`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { uploads: UploadRow[] };
    return data.uploads;
  }, [classroomId]);

  const loadBankTotal = useCallback(async () => {
    const response = await fetch(`/api/classrooms/${classroomId}/bank`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { total: number };
    return data.total;
  }, [classroomId]);

  useEffect(() => {
    void loadBankTotal().then((total) => {
      if (total !== null) {
        setBankBefore((current) => current ?? total);
      }
    });
  }, [loadBankTotal]);

  const sessionUploads = uploads.filter((upload) =>
    sessionIds.includes(upload.id),
  );
  const processing = sessionUploads.some(
    (upload) =>
      upload.extractionStatus === "pending" ||
      upload.extractionStatus === "running",
  );
  const pointsDelta =
    bankBefore !== null && bankAfter !== null
      ? Math.max(0, bankAfter - bankBefore)
      : null;
  const readyForReview =
    sessionUploads.length > 0 &&
    !processing &&
    pointsDelta !== null &&
    pointsDelta > 0;
  const { data: bankPoints } = useBank(classroomId, readyForReview);
  const newPoints =
    bankPoints
      ?.filter((point) => sessionIds.includes(point.sourceUploadId))
      .slice(0, 8) ?? [];

  useEffect(() => {
    if (!processing) {
      return;
    }
    const interval = setInterval(() => {
      void loadUploads().then((rows) => {
        if (rows) {
          setUploads(rows);
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [processing, loadUploads]);

  useEffect(() => {
    if (
      sessionIds.length === 0 ||
      processing ||
      bankAfter !== null ||
      bankBefore === null
    ) {
      return;
    }
    void loadBankTotal().then((total) => {
      if (total !== null) {
        setBankAfter(total);
        void queryClient.invalidateQueries({
          queryKey: keys.bank(classroomId),
        });
        void queryClient.invalidateQueries({
          queryKey: keys.overview(classroomId),
        });
      }
    });
  }, [
    sessionIds.length,
    processing,
    bankAfter,
    bankBefore,
    loadBankTotal,
    classroomId,
    queryClient,
  ]);

  const refresh = async () => {
    const rows = await loadUploads();
    if (rows) {
      setUploads(rows);
    }
  };

  const addFiles = (selected: File[]) => {
    setFileError(null);
    const next = [...files];
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        setFileError(t("notImage", { name: file.name }));
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setFileError(t("tooLarge", { name: file.name }));
        continue;
      }
      if (next.length >= MAX_FILES) {
        setFileError(t("tooMany", { max: MAX_FILES }));
        break;
      }
      next.push(file);
    }
    setFiles(next);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  // Typed notes open the preview first, so the learner sees the numbered lines
  // the reading will use; images alone have no lines and upload straight away.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!text.trim() && files.length === 0) {
      setFormError(t("emptyForm"));
      return;
    }
    if (text.trim()) {
      setPreviewOpen(true);
      return;
    }
    void upload();
  };

  const upload = async () => {
    const trimmed = text.trim();
    setSubmitting(true);
    const before = bankBefore ?? (await loadBankTotal());
    if (before !== null) {
      setBankBefore(before);
    }
    setBankAfter(null);
    const ids: string[] = [];
    try {
      if (trimmed) {
        const response = await fetch(`/api/classrooms/${classroomId}/uploads`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        if (!response.ok) {
          throw await uploadFailure(response, t("couldNotSaveNotes"));
        }
        const data = (await response.json()) as { uploadIds: string[] };
        ids.push(...data.uploadIds);
      }
      if (files.length > 0) {
        const formData = new FormData();
        for (const file of files) {
          formData.append("files", file);
        }
        const response = await fetch(`/api/classrooms/${classroomId}/uploads`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw await uploadFailure(response, t("couldNotSaveImages"));
        }
        const data = (await response.json()) as { uploadIds: string[] };
        ids.push(...data.uploadIds);
      }
      setSessionIds(ids);
      setPreviewOpen(false);
      if (isGuest && ids.length > 0) {
        setShowGuestModal(true);
      }
      setText("");
      setFiles([]);
      setFileInputKey((key) => key + 1);
      const rows = await loadUploads();
      setUploads(rows ?? []);
    } catch (error) {
      setPreviewOpen(false);
      if (error instanceof UploadLimitError) {
        setLimitReached(true);
      } else {
        setFormError(
          error instanceof Error ? error.message : tCommon("genericError"),
        );
      }
    } finally {
      setSubmitting(false);
      // The weekly count moved; the limit card and the classroom list read it.
      void queryClient.invalidateQueries({ queryKey: keys.classrooms });
    }
  };

  return (
    <div className="space-y-6">
      {outOfUploads ? (
        <UploadLimitCard resetsAt={limits?.weekResetsAt ?? null} />
      ) : (
        <form onSubmit={handleSubmit}>
          <Card className="overflow-visible bg-card/75">
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <section>
                <div className="mb-4 flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary">
                    <FileText className="size-4" />
                  </span>
                  <div>
                    <Label
                      htmlFor="note-text"
                      className="mb-0 font-heading text-lg font-semibold"
                    >
                      {t("pasteLabel")}
                    </Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t("textHint")}
                    </p>
                  </div>
                </div>
                <Textarea
                  id="note-text"
                  rows={12}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={t("pastePlaceholder")}
                  className="paper-lines min-h-80 resize-y bg-background/45 leading-8"
                />
              </section>

              <section>
                <div className="mb-4 flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary">
                    <ImagePlus className="size-4" />
                  </span>
                  <div>
                    <Label className="mb-0 font-heading text-lg font-semibold">
                      {t("attachImages")}
                    </Label>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t("upToImages", { max: MAX_FILES })}
                    </p>
                  </div>
                </div>
                <motion.div
                  animate={{ scale: dragActive ? 1.025 : 1 }}
                  transition={PEEK_SPRING}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    ) {
                      setDragActive(false);
                    }
                  }}
                  onDrop={handleDrop}
                  className={`grid min-h-48 place-items-center rounded-2xl border border-dashed p-6 text-center transition-colors ${
                    dragActive
                      ? "border-primary bg-primary/[0.08]"
                      : "border-border bg-muted/25 hover:border-primary/30 hover:bg-primary/[0.035]"
                  }`}
                >
                  <div>
                    <motion.span
                      className="block"
                      animate={
                        dragActive ? { y: -6, scale: 1.2 } : { y: 0, scale: 1 }
                      }
                      transition={PEEK_SPRING}
                    >
                      <UploadCloud
                        className="mx-auto size-6 text-primary"
                        strokeWidth={1.6}
                      />
                    </motion.span>
                    <p className="mt-4 text-sm font-medium">{t("dropTitle")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("dropCopy")}
                    </p>
                    <Label
                      htmlFor={`note-images-${fileInputKey}`}
                      className="mx-auto mt-4 inline-flex h-9 w-fit cursor-pointer items-center rounded-[0.7rem] border border-border bg-card px-3.5 text-sm shadow-sm transition hover:border-primary/25 hover:bg-accent"
                    >
                      {t("chooseImages")}
                    </Label>
                    <input
                      key={fileInputKey}
                      id={`note-images-${fileInputKey}`}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFiles}
                      className="sr-only"
                    />
                  </div>
                </motion.div>
                {fileError ? (
                  <p className="mt-2 text-sm text-destructive">{fileError}</p>
                ) : null}
                <ul className="mt-3 grid grid-cols-2 gap-2 empty:hidden sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence initial={false}>
                    {files.map((file, index) => (
                      <SelectedFilePreview
                        key={`${file.name}-${file.lastModified}-${index}`}
                        file={file}
                        onRemove={() =>
                          setFiles((current) =>
                            current.filter(
                              (_, fileIndex) => fileIndex !== index,
                            ),
                          )
                        }
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            </CardContent>
            <div className="flex flex-col gap-3 border-t border-border/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {formError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("backgroundHint")}
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {submitting ? t("savingNotes") : t("uploadNotes")}
                {!submitting ? <ArrowRight /> : null}
              </Button>
            </div>
          </Card>
        </form>
      )}
      <NotesPreviewDialog
        open={previewOpen}
        text={text}
        imageCount={files.length}
        freeUploadsLeft={
          limits ? Math.max(0, limits.uploadsPerWeek - limits.uploadsThisWeek) : null
        }
        submitting={submitting}
        onTextChange={setText}
        onBack={() => setPreviewOpen(false)}
        onConfirm={() => void upload()}
      />
      {sessionIds.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={PEEK_SPRING}
        >
          <Card
            className="border-primary/15 bg-primary/[0.035]"
            aria-live="polite"
          >
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">{t("statusKicker")}</p>
                  <h2 className="mt-2 font-heading text-2xl font-semibold">
                    {processing ? t("readingNotes") : t("processingFinished")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {processing ? t("processingBlurb") : t("finishedBlurb")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refresh()}
                >
                  {t("checkStatus")}
                </Button>
              </div>
              <ul className="mt-4 space-y-3">
                {sessionUploads.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    {t("waiting")}
                  </li>
                ) : null}
                {sessionUploads.map((upload) => {
                  const showPoints =
                    pointsDelta !== null &&
                    upload.extractionStatus === "done" &&
                    sessionUploads.length === 1;
                  return (
                    <li
                      key={upload.id}
                      className="rounded-xl border border-border/70 bg-card/65 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm">
                          {upload.subject ??
                            (upload.kind === "image"
                              ? (upload.originalFilename ?? t("image"))
                              : firstLine(upload.textContent, t("textNotes")))}
                        </p>
                        <motion.span
                          key={upload.extractionStatus}
                          className="shrink-0"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={PEEK_SPRING}
                        >
                          <StatusBadge status={upload.extractionStatus} />
                        </motion.span>
                      </div>
                      {upload.extractionStatus === "done" ? (
                        <p className="mt-2 text-sm text-success">
                          {showPoints
                            ? t("pointsPrefix", { points: pointsDelta })
                            : ""}
                          {t("linesSkipped", { count: upload.discardedCount })}
                        </p>
                      ) : null}
                      {upload.extractionStatus === "failed" ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-destructive">
                            {upload.extractionError ?? t("extractionFailed")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("keptBlurb")}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {!processing &&
              pointsDelta !== null &&
              sessionUploads.length > 1 ? (
                <p className="mt-3 text-sm text-success">
                  {t("pointsAdded", { count: pointsDelta })}
                </p>
              ) : null}
              {readyForReview && newPoints.length > 0 ? (
                <ul
                  className="mt-4 flex flex-wrap gap-2"
                  aria-label={t("openBank")}
                >
                  {newPoints.map((point) => (
                    <li key={point.id}>
                      <Link
                        to={`/classrooms/${classroomId}/bank/${point.id}`}
                        className="inline-block rounded-lg border border-primary/15 bg-card px-3 py-2 text-sm hover:border-primary/40"
                      >
                        <span className="font-medium">{point.targetText}</span>
                        {point.nativeText ? (
                          <span className="ml-2 text-muted-foreground">
                            {point.nativeText}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                {readyForReview ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link to={`/classrooms/${classroomId}?create=1`}>
                        {t("startReview")}
                        <ArrowRight />
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to={`/classrooms/${classroomId}/bank`}>
                        {t("openBank")}
                      </Link>
                    </Button>
                  </div>
                ) : null}
                <Link
                  className="inline-flex items-center gap-1 font-medium text-muted-foreground transition hover:text-foreground"
                  to={`/classrooms/${classroomId}/notes`}
                >
                  {t("viewHistory")}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {isGuest ? (
                <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.08] p-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("guestStatusPrompt")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("guestModalDescription")}
                    </p>
                  </div>
                  <Button asChild size="sm" className="shrink-0">
                    <a href="/signup">
                      {t("guestModalSignUp")}
                      <ArrowRight className="ml-1 size-3.5" />
                    </a>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <Dialog open={showGuestModal} onOpenChange={setShowGuestModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-semibold">
              {t("guestModalTitle")}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("guestModalDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowGuestModal(false)}>
              {t("guestModalContinue")}
            </Button>
            <Button asChild size="default">
              <a href="/signup">
                {t("guestModalSignUp")}
                <ArrowRight className="ml-1 size-4" />
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
