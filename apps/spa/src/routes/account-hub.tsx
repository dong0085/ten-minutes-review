import { useTranslations } from "use-intl";
import {
  Archive,
  CreditCard,
  KeyRound,
  Mail,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@tmr/ui/components/badge";
import { AccountHeader } from "@/components/account/account-header";
import { AccountStats } from "@/components/account/account-stats";
import { QuizLogbook } from "@/components/account/quiz-logbook";
import { DrillList, SectionTitle } from "@/components/page";
import { FullPageSpinner } from "@/app/shell";
import { useAccountOverview } from "@/lib/account";
import { useSession } from "@/lib/session";
import { ErrorPanel } from "./errors";

/** How the learner is doing, then one row per settings screen. */
export function AccountHubPage() {
  const t = useTranslations("Account");
  const tHub = useTranslations("App.AccountHub");
  const { data: session } = useSession();
  const { data, isPending, error, refetch } = useAccountOverview();

  if (isPending || !session) {
    return <FullPageSpinner />;
  }
  if (error || !data) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  const { user } = session;
  const displayName = user.username ?? user.email.split("@")[0] ?? user.email;

  return (
    <div className="space-y-10">
      <AccountHeader
        kicker={t("title")}
        title={t("greeting", { name: displayName })}
        description={t("overview")}
      />

      <AccountStats
        activity={data.activity}
        learning={data.learning}
        attempts={data.attempts}
        misses={data.misses}
      />

      <QuizLogbook quizzes={data.quizzes} hasMore={data.hasMoreQuizzes} limit={data.quizLimit} />

      <section className="space-y-3">
        <SectionTitle>{tHub("settings")}</SectionTitle>
        <DrillList
          items={[
            {
              to: "/account/profile",
              icon: UserRound,
              title: tHub("profile"),
              meta: tHub("profileMeta"),
            },
            {
              to: "/account/security",
              icon: ShieldCheck,
              title: tHub("security"),
              meta: tHub("securityMeta"),
            },
            { to: "/account/email", icon: Mail, title: tHub("email"), meta: tHub("emailMeta") },
            {
              to: "/account/plan",
              icon: CreditCard,
              title: tHub("plan"),
              meta: tHub("planMeta"),
              badge: (
                <Badge variant={data.membership.isPaid ? "success" : "secondary"}>
                  {data.membership.isPaid ? t("pro") : t("free")}
                </Badge>
              ),
            },
            {
              to: "/account/referrals",
              icon: Send,
              title: tHub("referrals"),
              meta: tHub("referralsMeta"),
            },
            {
              to: "/account/tokens",
              icon: KeyRound,
              title: tHub("tokens"),
              meta: tHub("tokensMeta"),
            },
            { to: "/account/data", icon: Archive, title: tHub("data"), meta: tHub("dataMeta") },
          ]}
        />
      </section>
    </div>
  );
}
