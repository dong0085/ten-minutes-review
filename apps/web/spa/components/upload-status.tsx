import { useTranslations } from "use-intl";
import { Badge } from "@tmr/ui/components/badge";
import { isRereading, type Upload } from "@/spa/lib/queries";

export function UploadStatusBadge({ upload }: { upload: Upload }) {
  const t = useTranslations("Classroom.HistoryPage");
  const status = upload.extractionStatus;
  if (isRereading(upload)) {
    return <Badge variant="warning">{t("statusRereading")}</Badge>;
  }
  if (status === "done") {
    return <Badge variant="success">{t("statusProcessed")}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive">{t("statusFailed")}</Badge>;
  }
  return (
    <Badge variant="warning">{status === "running" ? t("statusReading") : t("statusQueued")}</Badge>
  );
}
