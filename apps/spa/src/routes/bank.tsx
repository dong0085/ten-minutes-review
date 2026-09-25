import { Link, useParams } from "react-router";
import { useTranslations } from "use-intl";
import { Library } from "lucide-react";
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
import { BankManager } from "@/components/classroom/bank-manager";
import { PageHeader } from "@/components/page";
import { FullPageSpinner } from "@/app/shell";
import { useBank } from "@/lib/queries";
import { ErrorPanel } from "./errors";

export function BankPage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations("Classroom.BankPage");
  const { data: items, isPending, error, refetch } = useBank(id);

  if (isPending) {
    return <FullPageSpinner />;
  }
  if (error || !items) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  const omitted = items.filter((item) => item.isRetired).length;
  const addNotes = (
    <Button asChild variant="outline">
      <Link to={`/classrooms/${id}/notes/new`}>{t("addNotes")}</Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={
          <>
            {t("blurb")}
            {items.length > 0 ? (
              <span className="mt-1 block text-xs tabular-nums">
                {t("summary", { active: items.length - omitted, omitted })}
              </span>
            ) : null}
          </>
        }
        actions={addNotes}
      />
      {items.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Library />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("empty")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>{addNotes}</EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <BankManager classroomId={id} items={items} />
      )}
    </div>
  );
}
