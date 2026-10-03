import { useState } from "react";
import { useTranslations } from "use-intl";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { previewNoteLines, splitLongNoteLines } from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tmr/ui/components/dialog";

/**
 * The last look before notes are read: each line with the number the reading
 * will use, long lines flagged with a one-tap split, and what confirming costs.
 * The count is lines, not points: only the reading knows how many points a
 * note holds.
 */
export function NotesPreviewDialog({
  open,
  text,
  imageCount,
  freeUploadsLeft,
  submitting,
  onTextChange,
  onBack,
  onConfirm,
}: {
  open: boolean;
  text: string;
  imageCount: number;
  /** Free uploads left this week; null when the plan has no weekly cap. */
  freeUploadsLeft: number | null;
  submitting: boolean;
  onTextChange: (text: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("Upload.Panel");
  const [beforeSplit, setBeforeSplit] = useState<string | null>(null);
  const preview = previewNoteLines(text);
  const long = new Set(preview.longLines);
  const uploadsUsed = 1 + imageCount;

  function split() {
    setBeforeSplit(text);
    onTextChange(splitLongNoteLines(text));
  }

  function undoSplit() {
    if (beforeSplit !== null) {
      onTextChange(beforeSplit);
      setBeforeSplit(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) {
          setBeforeSplit(null);
          onBack();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("previewTitle")}</DialogTitle>
          <DialogDescription>{t("previewBlurb")}</DialogDescription>
        </DialogHeader>

        <ol
          aria-label={t("previewTitle")}
          className="max-h-[45vh] overflow-y-auto rounded-xl border border-border/70 bg-background/60 py-2 font-mono text-[13px] leading-6"
        >
          {preview.lines.map((line, index) => (
            <li
              key={index}
              className={`grid grid-cols-[2rem_1fr_1.25rem] gap-2 px-2 sm:grid-cols-[2.75rem_1fr_1.5rem] ${
                long.has(index) ? "bg-warning/10" : ""
              }`}
            >
              <span className="text-right text-muted-foreground tabular-nums select-none">
                {index + 1}
              </span>
              <span className="min-w-0 break-words whitespace-pre-wrap">{line || " "}</span>
              {long.has(index) ? (
                <AlertTriangle
                  className="mt-1 size-3.5 text-warning"
                  aria-label={t("previewLongLabel")}
                />
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>

        <div className="space-y-2 text-sm">
          <p className="font-medium">
            {t("previewLines", { count: preview.filledCount })}
            {imageCount > 0 ? ` ${t("previewImages", { count: imageCount })}` : null}
          </p>
          {preview.longLines.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-warning/10 px-3 py-2">
              <p className="min-w-0 flex-1 text-muted-foreground">
                {t("previewLong", {
                  count: preview.longLines.length,
                  numbers: preview.longLines.map((index) => index + 1).join(", "),
                })}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={split}>
                {t("previewSplit")}
              </Button>
            </div>
          ) : beforeSplit !== null ? (
            <p className="text-muted-foreground">
              {t("previewSplitDone")}{" "}
              <button
                type="button"
                onClick={undoSplit}
                className="text-primary underline underline-offset-4"
              >
                {t("previewUndo")}
              </button>
            </p>
          ) : null}
          {freeUploadsLeft !== null ? (
            <p className="text-xs text-muted-foreground">
              {t("previewUsesUpload", { used: uploadsUsed, left: freeUploadsLeft })}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => {
              setBeforeSplit(null);
              onBack();
            }}
          >
            {t("previewBack")}
          </Button>
          <Button type="button" disabled={submitting} onClick={onConfirm}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {submitting ? t("savingNotes") : t("previewConfirm", { count: preview.filledCount })}
            {!submitting ? <ArrowRight /> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
