import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { hasPaidAccess } from "@tmr/core";
import {
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountHeader } from "@/components/account/account-header";
import { AccountStats } from "@/components/account/account-stats";
import { BillingButton } from "@/components/account/billing-button";
import { CopyButton } from "@/components/account/copy-button";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { languageLabel } from "@/lib/language-label";
import { requireUser } from "@/lib/session";

const RECENT_QUIZ_LIMIT = 10;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const t = await getTranslations("Account");
  const tNav = await getTranslations("Account.Nav");
  const locale = await getLocale();
  const format = await getFormatter();
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
    ]);
  const isPaid = hasPaidAccess(subscription);
  const paymentIssue =
    subscription?.status === "past_due" || subscription?.status === "unpaid";

  const shareUrl = referral.code ? `${env.appUrl}/signup?code=${referral.code}` : env.appUrl;

  const recentQuizzes = quizzes.slice(0, RECENT_QUIZ_LIMIT);

  return (
    <div className="space-y-7">
      <AccountHeader title={tNav("overview")} description={t("overview")} />

      <AccountStats
        activity={activity}
        learning={learning}
        attempts={attempts}
        misses={misses}
      />

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("classroomsSection")}</h2>
          {classrooms.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noClassrooms")}{" "}
              <Link className="underline hover:text-foreground" href="/classrooms">
                {t("createOne")}
              </Link>
              .
            </p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("classroomsSection")}</TableHead>
                  <TableHead className="text-right">{t("languages")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms.map((classroom) => (
                  <TableRow key={classroom.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/classrooms/${classroom.id}`}>
                        {classroom.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {t("languagePair", {
                        target: languageLabel(classroom.targetLanguage, locale),
                        native: languageLabel(classroom.nativeLanguage, locale),
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("quizHistorySection")}</h2>
          {recentQuizzes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("noQuizzes")}</p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("classroomsSection")}</TableHead>
                  <TableHead>{t("quizDate")}</TableHead>
                  <TableHead className="text-right">{t("quizResults")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQuizzes.map((quiz) => (
                  <TableRow key={quiz.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/classrooms/${quiz.classroomId}/quizzes`}>
                        {quiz.classroomName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link className="text-muted-foreground hover:underline" href={`/classrooms/${quiz.classroomId}/quiz/${quiz.id}`}>
                        {/* quizDate is a calendar day, so format it in UTC to keep the same day. */}
                        {format.dateTime(new Date(`${quiz.quizDate}T00:00:00Z`), {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {quiz.bestScore !== null
                        ? t("bestScore", { score: quiz.bestScore, size: quiz.size })
                        : t("quizQuestions", { count: quiz.size })}{" "}
                      · {t("attempts", { count: quiz.attemptCount })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {quizzes.length > RECENT_QUIZ_LIMIT ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("quizHistoryMore", { count: RECENT_QUIZ_LIMIT })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("referralsSection")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("shareBlurb")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-sm">
              {referral.code ?? t("pending")}
            </code>
            <span className="break-all text-sm text-muted-foreground">{shareUrl}</span>
            {referral.code ? <CopyButton value={shareUrl} /> : null}
          </div>
          {referrals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noSignUps")}</p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("referralDate")}</TableHead>
                  <TableHead className="text-right">{t("referralStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {t("signedUp", {
                        when: format.dateTime(entry.createdAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={entry.status === "rewarded" ? "success" : "secondary"}>
                        {entry.status === "rewarded"
                          ? t("statusRewarded")
                          : entry.status === "signed_up"
                            ? t("statusSignedUp")
                            : t("statusCreated")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {env.billingEnabled ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-semibold">{t("subscriptionSection")}</h2>
              <Badge variant={isPaid ? "success" : "secondary"}>
                {isPaid ? t("pro") : t("free")}
              </Badge>
            </div>
            {params.billing === "success" && !isPaid ? (
              <p className="text-sm text-muted-foreground">{t("billingSuccess")}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {isPaid ? t("planProBlurb") : t("planFreeBlurb")}
              {isPaid && subscription?.currentPeriodEnd ? (
                <>
                  {" "}
                  {t(subscription.cancelAtPeriodEnd ? "endsOn" : "renewsOn", {
                    date: format.dateTime(subscription.currentPeriodEnd, { dateStyle: "medium" }),
                  })}
                </>
              ) : null}
            </p>
            {paymentIssue ? (
              <p className="text-sm text-destructive">{t("paymentIssue")}</p>
            ) : null}
            <BillingButton action={subscription?.stripeCustomerId && (isPaid || paymentIssue) ? "portal" : "checkout"} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
