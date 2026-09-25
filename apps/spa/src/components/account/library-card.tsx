import { useFormatter, useLocale, useTranslations } from "use-intl";
import { FREE_TIER } from "@tmr/core";
import { BillingButton } from "@/components/account/billing-button";
import { Avatar, AvatarFallback, AvatarImage } from "@tmr/ui/components/avatar";
import { languageLabel } from "@/lib/language-label";
import { cn } from "@tmr/ui/utils";

type Membership = {
  isPaid: boolean;
  paymentIssue: boolean;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  billingAction: "checkout" | "portal";
  justSubscribed: boolean;
};

// A row of filled and empty pips, e.g. 2 of 3 classrooms used.
function Pips({ used, limit }: { used: number; limit: number }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: limit }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-2 w-5 rounded-full transition-colors",
            index < used
              ? used >= limit
                ? "bg-warning"
                : "bg-primary"
              : "bg-foreground/10",
          )}
        />
      ))}
    </span>
  );
}

// Overview hero: a library card for the member on the left and a tear-off
// membership stub on the right.
export function LibraryCard({
  user,
  membership,
  usage,
  billingEnabled,
}: {
  user: {
    id: string;
    email: string;
    username: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    timezone: string;
    uiLanguage: string;
  };
  membership: Membership;
  usage: { classrooms: number; uploadsThisMonth: number };
  billingEnabled: boolean;
}) {
  const t = useTranslations("Account.LibraryCard");
  const tAccount = useTranslations("Account");
  const format = useFormatter();
  const locale = useLocale();
  const displayName = user.username ?? user.email.split("@")[0];
  const cardNumber = user.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const { isPaid } = membership;

  return (
    <section className="editorial-surface relative grid overflow-hidden rounded-[1.6rem] lg:grid-cols-[minmax(0,1fr)_17.5rem]">
      <div className="library-card relative px-6 py-6 pl-8 sm:px-8 sm:pl-10">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{t("kicker")}</p>
          <p className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground">
            № {cardNumber.slice(0, 4)}·{cardNumber.slice(4)}
          </p>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Avatar className="size-16 ring-4 ring-card shadow-[0_4px_14px_rgb(var(--shadow-colour)/0.12)]">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 font-heading text-2xl text-primary">
              {displayName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {displayName}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-dashed border-border pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {t("memberSince")}
            </dt>
            <dd className="mt-1 font-medium">
              {format.dateTime(user.createdAt, { month: "long", year: "numeric" })}
            </dd>
          </div>
          <div>
            <dt className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {t("language")}
            </dt>
            <dd className="mt-1 font-medium">{languageLabel(user.uiLanguage, locale)}</dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {t("timezone")}
            </dt>
            <dd className="mt-1 truncate font-medium">{user.timezone.replace(/_/g, " ")}</dd>
          </div>
        </dl>
      </div>

      {/* Tear-off stub. The perforation runs down (wide) or across (narrow). */}
      <div className="relative flex flex-col gap-4 border-t border-dashed border-border bg-muted/35 px-6 py-6 sm:px-8 lg:border-t-0 lg:border-l lg:px-6">
        <span
          aria-hidden="true"
          className="absolute -top-2.5 -left-2.5 hidden size-5 rounded-full border border-border/70 bg-background lg:block"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-2.5 -left-2.5 hidden size-5 rounded-full border border-border/70 bg-background lg:block"
        />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{t("membership")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPaid ? tAccount("planProBlurb") : t("freeShort")}
            </p>
          </div>
          <span
            className={cn(
              "ink-stamp grid size-16 shrink-0 place-items-center rounded-full font-heading text-sm font-bold tracking-[0.12em] uppercase",
              isPaid ? "text-success" : "text-primary/80",
            )}
          >
            {isPaid ? tAccount("pro") : tAccount("free")}
          </span>
        </div>

        {isPaid ? (
          membership.periodEnd ? (
            <p className="text-sm font-medium">
              {tAccount(membership.cancelAtPeriodEnd ? "endsOn" : "renewsOn", {
                date: format.dateTime(membership.periodEnd, { dateStyle: "medium" }),
              })}
            </p>
          ) : null
        ) : (
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("classrooms")}</span>
              <span className="flex items-center gap-2">
                <Pips used={Math.min(usage.classrooms, FREE_TIER.classrooms)} limit={FREE_TIER.classrooms} />
                <span className="w-8 text-right text-xs tabular-nums">
                  {Math.min(usage.classrooms, FREE_TIER.classrooms)}/{FREE_TIER.classrooms}
                </span>
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("uploads")}</span>
              <span className="flex items-center gap-2">
                <Pips
                  used={Math.min(usage.uploadsThisMonth, FREE_TIER.notesUploadsPerMonth)}
                  limit={FREE_TIER.notesUploadsPerMonth}
                />
                <span className="w-8 text-right text-xs tabular-nums">
                  {Math.min(usage.uploadsThisMonth, FREE_TIER.notesUploadsPerMonth)}/
                  {FREE_TIER.notesUploadsPerMonth}
                </span>
              </span>
            </li>
          </ul>
        )}

        {membership.justSubscribed && !isPaid ? (
          <p className="text-sm text-success">{tAccount("billingSuccess")}</p>
        ) : null}
        {membership.paymentIssue ? (
          <p className="text-sm text-destructive">{tAccount("paymentIssue")}</p>
        ) : null}

        {billingEnabled ? (
          <div className="mt-auto">
            <BillingButton action={membership.billingAction} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
