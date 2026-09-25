
import { Link } from "react-router";
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useTranslations } from "use-intl";
import { ArrowRight, FileText, ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { MAX_IMAGE_BYTES } from "@tmr/core";
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
import { readError } from "@/lib/read-error";

const MAX_FILES = 10;

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

function SelectedFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const t = useTranslations("Upload.Panel");

  return (
    <li className="group relative overflow-hidden rounded-xl border border-border/70 bg-card">
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
    </li>
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

  const sessionUploads = uploads.filter((upload) => sessionIds.includes(upload.id));
  const processing = sessionUploads.some(
    (upload) => upload.extractionStatus === "pending" || upload.extractionStatus === "running",
  );
  const pointsDelta =
    bankBefore !== null && bankAfter !== null ? Math.max(0, bankAfter - bankBefore) : null;

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
    if (sessionIds.length === 0 || processing || bankAfter !== null || bankBefore === null) {
      return;
    }
    void loadBankTotal().then((total) => {
      if (total !== null) {
        setBankAfter(total);
      }
    });
  }, [sessionIds.length, processing, bankAfter, bankBefore, loadBankTotal]);

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) {
      setFormError(t("emptyForm"));
      return;
    }
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
          throw new Error((await readError(response)) ?? t("couldNotSaveNotes"));
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
          throw new Error((await readError(response)) ?? t("couldNotSaveImages"));
        }
        const data = (await response.json()) as { uploadIds: string[] };
        ids.push(...data.uploadIds);
      }
      setSessionIds(ids);
      if (isGuest && ids.length > 0) {
        setShowGuestModal(true);
      }
      setText("");
      setFiles([]);
      setFileInputKey((key) => key + 1);
      const rows = await loadUploads();
      setUploads(rows ?? []);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : tCommon("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Card className="overflow-visible bg-card/75">
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-4 flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary">
                  <FileText className="size-4" />
                </span>
                <div>
                  <Label htmlFor="note-text" className="mb-0 font-heading text-lg font-semibold">
                    {t("pasteLabel")}
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("textHint")}</p>
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
              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragActive(false);
                  }
                }}
                onDrop={handleDrop}
                className={`grid min-h-48 place-items-center rounded-2xl border border-dashed p-6 text-center transition ${
                  dragActive
                    ? "border-primary bg-primary/[0.08]"
                    : "border-border bg-muted/25 hover:border-primary/30 hover:bg-primary/[0.035]"
                }`}
              >
                <div>
                  <UploadCloud className="mx-auto size-6 text-primary" strokeWidth={1.6} />
                  <p className="mt-4 text-sm font-medium">{t("dropTitle")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("dropCopy")}</p>
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
              </div>
              {fileError ? <p className="mt-2 text-sm text-destructive">{fileError}</p> : null}
              {files.length > 0 ? (
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {files.map((file, index) => (
                    <SelectedFilePreview
                      key={`${file.name}-${file.lastModified}-${index}`}
                      file={file}
                      onRemove={() =>
                        setFiles((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          </CardContent>
          <div className="flex flex-col gap-3 border-t border-border/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : (
                <p className="text-xs text-muted-foreground">{t("backgroundHint")}</p>
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
      {sessionIds.length > 0 ? (
        <Card className="border-primary/15 bg-primary/[0.035]" aria-live="polite">
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
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              {t("checkStatus")}
            </Button>
          </div>
          <ul className="mt-4 space-y-3">
            {sessionUploads.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t("waiting")}</li>
            ) : null}
            {sessionUploads.map((upload) => {
              const showPoints =
                pointsDelta !== null &&
                upload.extractionStatus === "done" &&
                sessionUploads.length === 1;
              return (
                <li key={upload.id} className="rounded-xl border border-border/70 bg-card/65 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm">
                      {upload.subject ??
                        (upload.kind === "image"
                          ? (upload.originalFilename ?? t("image"))
                          : firstLine(upload.textContent, t("textNotes")))}
                    </p>
                    <StatusBadge status={upload.extractionStatus} />
                  </div>
                  {upload.extractionStatus === "done" ? (
                    <p className="mt-2 text-sm text-success">
                      {showPoints ? t("pointsPrefix", { points: pointsDelta }) : ""}
                      {t("linesSkipped", { count: upload.discardedCount })}
                    </p>
                  ) : null}
                  {upload.extractionStatus === "failed" ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-destructive">
                        {upload.extractionError ?? t("extractionFailed")}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("keptBlurb")}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {!processing && pointsDelta !== null && sessionUploads.length > 1 ? (
            <p className="mt-3 text-sm text-success">
              {t("pointsAdded", { count: pointsDelta })}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
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
                <p className="text-sm font-semibold text-foreground">{t("guestStatusPrompt")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("guestModalDescription")}</p>
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
