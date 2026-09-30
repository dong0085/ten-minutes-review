import { useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { useTranslations } from "use-intl";
import { EyeOff, Loader2, Lock, RotateCcw } from "lucide-react";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Input } from "@tmr/ui/components/input";
import { Label } from "@tmr/ui/components/label";
import { Textarea } from "@tmr/ui/components/textarea";
import { BankProDialog, useCanManageBank } from "@/spa/components/classroom/bank-pro-dialog";
import { BillingButton } from "@/spa/components/account/billing-button";
import { PageHeader, SectionTitle } from "@/spa/components/page";
import { FullPageSpinner } from "@/spa/app/shell";
import { useEditPoint, useToggleOmit } from "@/spa/lib/bank-actions";
import { useBank, type BankItem } from "@/spa/lib/queries";
import { useSession } from "@/spa/lib/session";
import { NotFoundPage } from "./not-found";

/** One knowledge point: what it says, how the learner does on it, and its wording. */
export function PointDetailPage() {
  const { id, pointId } = useParams() as { id: string; pointId: string };
  const t = useTranslations("Classroom.BankPage");
  const categoryT = useTranslations("Category");
  const { data: items, isPending } = useBank(id);
  const toggleOmit = useToggleOmit(id);
  const canManage = useCanManageBank();
  const { data: session } = useSession();

  if (isPending) {
    return <FullPageSpinner />;
  }
  const item = items?.find((entry) => entry.id === pointId);
  if (!item) {
    return <NotFoundPage />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        kicker={
          <span className="inline-flex flex-wrap items-center gap-1.5 normal-case tracking-normal">
            <Badge variant="secondary">{categoryT(item.category)}</Badge>
            {item.isRetired ? <Badge variant="outline">{t("omittedBadge")}</Badge> : null}
            {item.inferred ? (
              <Badge variant="warning" title={t("inferredHint")}>
                {t("inferredBadge")}
              </Badge>
            ) : null}
          </span>
        }
        title={<span className="break-words">{item.targetText}</span>}
        description={
          <>
            {item.nativeText ? <span className="block text-base">{item.nativeText}</span> : null}
            <span className="mt-1 block text-xs tabular-nums">
              {item.answered > 0
                ? t("stats", { answered: item.answered, missed: item.missed })
                : t("notAsked")}
            </span>
          </>
        }
        actions={
          canManage ? (
            <Button
              variant="outline"
              disabled={toggleOmit.isPending}
              onClick={() => toggleOmit.mutate({ id: item.id, omit: !item.isRetired })}
              title={item.isRetired ? t("restoreHint") : t("omitHint")}
            >
              {toggleOmit.isPending ? (
                <Loader2 className="animate-spin" />
              ) : item.isRetired ? (
                <RotateCcw />
              ) : (
                <EyeOff />
              )}
              {item.isRetired ? t("restore") : t("omit")}
            </Button>
          ) : (
            <BankProDialog>
              <Button variant="outline" title={t("omitLockedHint")}>
                <Lock />
                {item.isRetired ? t("restore") : t("omit")}
                <Badge>{t("proBadge")}</Badge>
              </Button>
            </BankProDialog>
          )
        }
      />

      {item.sourceExcerpt ? (
        <section className="space-y-2">
          <SectionTitle>{t("sourceLabel")}</SectionTitle>
          <p className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm leading-6 whitespace-pre-wrap text-muted-foreground">
            {item.sourceExcerpt}
          </p>
        </section>
      ) : null}

      {!canManage && item.note ? (
        <section className="space-y-2">
          <SectionTitle>{t("noteLabel")}</SectionTitle>
          <p className="text-sm leading-6 whitespace-pre-wrap">{item.note}</p>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionTitle>{t("editTitle")}</SectionTitle>
        {canManage ? (
          <>
            <p className="text-sm text-muted-foreground">{t("editBlurb")}</p>
            <EditPointForm key={item.id} classroomId={id} item={item} />
          </>
        ) : (
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/75 p-5">
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 font-medium">
                <Lock className="size-4 text-muted-foreground" />
                {t("proTitle")}
                <Badge>{t("proBadge")}</Badge>
              </p>
              <p className="text-sm text-muted-foreground">{t("proBody")}</p>
            </div>
            {session?.features.billing ? <BillingButton action="checkout" /> : null}
          </div>
        )}
      </section>
    </div>
  );
}

function EditPointForm({ classroomId, item }: { classroomId: string; item: BankItem }) {
  const t = useTranslations("Classroom.BankPage");
  const tCommon = useTranslations("Common");
  const [targetText, setTargetText] = useState(item.targetText);
  const [nativeText, setNativeText] = useState(item.nativeText ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const edit = useEditPoint(classroomId);
  const dirty =
    targetText !== item.targetText ||
    nativeText !== (item.nativeText ?? "") ||
    note !== (item.note ?? "");

  function save(event: FormEvent) {
    event.preventDefault();
    if (targetText.trim() === "") {
      setError(t("targetRequired"));
      return;
    }
    setError(null);
    edit.mutate(
      { id: item.id, targetText, nativeText, note },
      { onError: () => setError(t("saveError")) },
    );
  }

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-2xl border border-border/70 bg-card/75 p-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="point-target">{t("targetLabel")}</Label>
        <Input
          id="point-target"
          value={targetText}
          onChange={(event) => setTargetText(event.target.value)}
          maxLength={2000}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-native">{t("nativeLabel")}</Label>
        <Input
          id="point-native"
          value={nativeText}
          onChange={(event) => setNativeText(event.target.value)}
          maxLength={2000}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="point-note">{t("noteLabel")}</Label>
        <Textarea
          id="point-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty || edit.isPending}>
          {edit.isPending ? t("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
