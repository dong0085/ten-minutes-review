import { getTranslations } from "next-intl/server";
import { FREE_TIER, hasPaidAccess, startOfMonthAt } from "@tmr/core";
import {
  countUploadsSince,
  getActivityStats,
  getLearningStats,
  getOrCreateReferralCode,
  getSubscription,
  listClassrooms,
  listQuizzesForUser,
  listRecentAttemptScores,
  listRecentMissesForUser,
  listReferralsByReferrer,
} from "@tmr/db";
import { AccountHeader } from "@/components/account/account-header";
import { AccountStats } from "@/components/account/account-stats";
import { ClassroomIndex } from "@/components/account/classroom-index";
import { LibraryCard } from "@/components/account/library-card";
import { QuizLogbook } from "@/components/account/quiz-logbook";
import { ReferralPostcard } from "@/components/account/referral-postcard";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/session";

const RECENT_QUIZ_LIMIT = 8;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");
  const db = getDb();
  const [
    referral,
    referrals,
    activity,
    learning,
    attempts,
    misses,
    classrooms,
    quizzes,
    subscription,
    uploadsThisMonth,
  ] = await Promise.all([
    getOrCreateReferralCode(db, user.id),
    listReferralsByReferrer(db, user.id),
    getActivityStats(db, user.id, user.timezone),
    getLearningStats(db, user.id),
    listRecentAttemptScores(db, user.id),
    listRecentMissesForUser(db, user.id),
    listClassrooms(db, user.id),
    listQuizzesForUser(db, user.id, RECENT_QUIZ_LIMIT + 1),
    getSubscription(db, user.id),
    countUploadsSince(db, user.id, startOfMonthAt(user.timezone)),
  ]);
  const isPaid = hasPaidAccess(subscription);
  const paymentIssue =
    subscription?.status === "past_due" || subscription?.status === "unpaid";
  const shareUrl = referral.code ? `${env.appUrl}/signup?code=${referral.code}` : env.appUrl;
  const displayName = user.username ?? user.email.split("@")[0];

  return (
    <div className="space-y-10">
      <AccountHeader
        kicker={tNav("overview")}
        title={t("greeting", { name: displayName })}
        description={t("overview")}
      />

      <LibraryCard
        user={user}
        billingEnabled={env.billingEnabled}
        usage={{ classrooms: classrooms.length, uploadsThisMonth }}
        membership={{
          isPaid,
          paymentIssue,
          periodEnd: subscription?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
          billingAction:
            subscription?.stripeCustomerId && (isPaid || paymentIssue) ? "portal" : "checkout",
          justSubscribed: params.billing === "success",
        }}
      />

      <AccountStats activity={activity} learning={learning} attempts={attempts} misses={misses} />

      <QuizLogbook
        quizzes={quizzes.slice(0, RECENT_QUIZ_LIMIT)}
        hasMore={quizzes.length > RECENT_QUIZ_LIMIT}
        limit={RECENT_QUIZ_LIMIT}
      />

      <ClassroomIndex
        classrooms={classrooms}
        canAdd={isPaid || classrooms.length < FREE_TIER.classrooms}
      />

      <ReferralPostcard code={referral.code} shareUrl={shareUrl} referrals={referrals} />
    </div>
  );
}
