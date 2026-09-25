import { useFormatter, useTranslations } from "use-intl";
import { Gift } from "lucide-react";
import { CopyButton } from "@/components/account/copy-button";
import { cn } from "@tmr/ui/utils";

type Referral = { id: string; status: string; createdAt: Date };

// Referrals as an airmail postcard: the pitch on the left, the "address"
// lines with the share link on the right, and one postmark per sign-up.
export function ReferralPostcard({
  code,
  shareUrl,
  referrals,
}: {
  code: string | null;
  shareUrl: string;
  referrals: Referral[];
}) {
  const t = useTranslations("Account");
  const format = useFormatter();
  const rewarded = referrals.filter((entry) => entry.status === "rewarded").length;

  return (
    <section className="airmail-border rounded-[1.1rem] bg-card bg-[image:var(--paper-grain)] shadow-[0_18px_60px_rgb(var(--shadow-colour)/0.06)]">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
        <div>
          <p className="eyebrow">{t("Postcard.kicker")}</p>
          <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
            {t("Postcard.title")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("shareBlurb")}</p>
          <p className="mt-4 flex items-center gap-2 text-sm font-medium">
            <Gift className="size-4 text-primary" />
            {t("Postcard.earned", { count: rewarded })}
          </p>
        </div>

        <span aria-hidden="true" className="hidden bg-border md:block" />

        <div className="relative">
          {/* Stamp in the corner, showing the referral code. */}
          <div className="float-right ml-4 mb-3 -rotate-3 rounded-sm border-2 border-dashed border-primary/45 bg-primary/[0.06] px-3 py-2 text-center">
            <p className="text-[0.58rem] font-semibold tracking-[0.18em] text-primary uppercase">
              {t("Postcard.code")}
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold">{code ?? t("pending")}</p>
          </div>
          <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {t("Postcard.to")}
          </p>
          <p className="clear-right border-b border-border pt-3 pb-1 font-heading text-lg italic">
            {t("Postcard.friend")}
          </p>
          <p className="break-all border-b border-border pt-3 pb-1 text-sm text-muted-foreground">
            {shareUrl}
          </p>
          {code ? (
            <div className="mt-4">
              <CopyButton value={shareUrl} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-dashed border-border px-6 py-5 sm:px-8">
        {referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSignUps")}</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {referrals.map((entry, index) => (
              <li
                key={entry.id}
                className={cn(
                  "grid size-24 place-items-center rounded-full border-2 p-2 text-center",
                  index % 2 === 0 ? "-rotate-6" : "rotate-3",
                  entry.status === "rewarded"
                    ? "border-success/60 text-success"
                    : "border-muted-foreground/40 text-muted-foreground",
                )}
              >
                <span>
                  <span className="block text-[0.6rem] font-bold tracking-[0.14em] uppercase">
                    {entry.status === "rewarded"
                      ? t("statusRewarded")
                      : entry.status === "signed_up"
                        ? t("statusSignedUp")
                        : t("statusCreated")}
                  </span>
                  <span className="mt-1 block text-xs font-medium">
                    {format.dateTime(entry.createdAt, { month: "short", day: "numeric" })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
