import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Library } from "lucide-react";
import { getClassroom, listBankForUser } from "@tmr/db";
import { BankManager } from "@/components/classroom/bank-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { toBankItem } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function BankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ allowGuest: true });
  const t = await getTranslations("Classroom.BankPage");
  const db = getDb();
  const classroom = await getClassroom(db, user.id, id);
  if (!classroom) {
    notFound();
  }
  const rows = await listBankForUser(db, user.id, id);
  const items = rows.map((row) => toBankItem(row.point, row.answered, row.missed));
  const omitted = items.filter((item) => item.isRetired).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("blurb")}</p>
          {items.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {t("summary", { active: items.length - omitted, omitted })}
            </p>
          ) : null}
        </div>
        <Button asChild variant="outline">
          <Link href={`/classrooms/${id}/upload`}>{t("addNotes")}</Link>
        </Button>
      </div>
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
              <EmptyContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/classrooms/${id}/upload`}>{t("addNotes")}</Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <BankManager initialItems={items} />
      )}
    </div>
  );
}
