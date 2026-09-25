import { useTranslations } from "use-intl";
import { Badge } from "@tmr/ui/components/badge";
import type { Upload } from "@/lib/queries";

export function UploadStatusBadge({ status }: { status: Upload["extractionStatus"] }) {
  const t = useTranslations("Classroom.HistoryPage");
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
