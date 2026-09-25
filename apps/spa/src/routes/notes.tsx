import { Link, useParams } from "react-router";
import { useFormatter, useTranslations } from "use-intl";
import { ChevronRight, FileText, Image as ImageIcon, NotebookPen } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import { Card, CardContent } from "@tmr/ui/components/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@tmr/ui/components/empty";
import { PageHeader } from "@/components/page";
import { UploadStatusBadge } from "@/components/upload-status";
import { FullPageSpinner } from "@/app/shell";
import { useUploads } from "@/lib/queries";
import { uploadTitle } from "@/lib/uploads";
import { ErrorPanel } from "./errors";

export function NotesPage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations("Classroom.HistoryPage");
  const format = useFormatter();
  const { data: uploads, isPending, error, refetch } = useUploads(id);

  if (isPending) {
    return <FullPageSpinner />;
  }
  if (error || !uploads) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("blurb")}
        actions={
          <Button asChild>
            <Link to={`/classrooms/${id}/notes/new`}>{t("addNotes")}</Link>
          </Button>
        }
      />
      {uploads.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <NotebookPen />
                </EmptyMedia>
                <EmptyTitle>{t("title")}</EmptyTitle>
                <EmptyDescription>{t("empty")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/classrooms/${id}/notes/new`}>{t("addNotes")}</Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/75">
          {uploads.map((upload) => {
            const Icon = upload.kind === "image" ? ImageIcon : FileText;
            return (
              <li key={upload.id}>
                <Link
                  to={`/classrooms/${id}/notes/${upload.id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.04] sm:px-5"
                >
                  {upload.imageUrl ? (
                    <img
                      src={upload.imageUrl}
                      alt=""
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {uploadTitle(upload, { text: t("textNotes"), image: t("image") })}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {format.dateTime(new Date(upload.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {upload.discardedCount > 0
                        ? ` · ${t("linesSkipped", { count: upload.discardedCount })}`
                        : null}
                    </span>
                  </span>
                  <UploadStatusBadge status={upload.extractionStatus} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
