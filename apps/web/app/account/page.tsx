import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import {
  getActivityStats,
  getEmailPreferences,
  getLearningStats,
  getOrCreateReferralCode,
  listClassrooms,
  listQuizzesForUser,
  listRecentAttemptScores,
  listRecentMissesForUser,
  listReferralsByReferrer,
} from "@tmr/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountStats } from "@/components/account/account-stats";
import { DeleteAccount } from "@/components/account/delete-account";
import { EmailPreferencesForm } from "@/components/account/email-preferences-form";
import { ProfileForm } from "@/components/account/profile-form";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { languageLabel } from "@/lib/language-label";
import { formatResetTime } from "@/lib/send-time";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function AccountPage() {
  const user = await requireUser();
  const t = await getTranslations("Account");
  const locale = await getLocale();
  const format = await getFormatter();
  const reset = formatResetTime(locale, user.timezone);
  const db = getDb();
  const [
    preferences,
    classrooms,
    quizzes,
    referral,
    referrals,
    activity,
    learning,
    attempts,
    misses,
  ] = await Promise.all([
    getEmailPreferences(db, user.id),
    listClassrooms(db, user.id),
    listQuizzesForUser(db, user.id),
    getOrCreateReferralCode(db, user.id),
    listReferralsByReferrer(db, user.id),
    getActivityStats(db, user.id, user.timezone),
    getLearningStats(db, user.id),
    listRecentAttemptScores(db, user.id),
    listRecentMissesForUser(db, user.id),
  ]);

  const shareUrl = referral.code ? `${env.appUrl}/signup?code=${referral.code}` : env.appUrl;

  const groupedQuizzes = new Map<string, { classroomName: string; quizzes: typeof quizzes }>();
  for (const quiz of quizzes) {
    const group = groupedQuizzes.get(quiz.classroomId);
    if (group) {
      group.quizzes.push(quiz);
    } else {
      groupedQuizzes.set(quiz.classroomId, {
        classroomName: quiz.classroomName,
        quizzes: [quiz],
      });
    }
  }

  return (
    <div className="space-y-7">
      <div className="border-b border-border/70 pb-7">
        <p className="eyebrow">{t("overview")}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.username ?? user.email}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{t("free")}</Badge>
          {user.username ? <span>{user.email}</span> : null}
          <span>
            {t("memberSince", {
              date: format.dateTime(user.createdAt, { month: "long", year: "numeric" }),
            })}
          </span>
        </div>
      </div>

      <AccountStats
        activity={activity}
        learning={learning}
        attempts={attempts}
        misses={misses}
      />

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("profileSection")}</h2>
          <ProfileForm
            defaultUsername={user.username}
            defaultUiLanguage={user.uiLanguage}
            defaultTimezone={user.timezone}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("emailPreferencesSection")}</h2>
          <EmailPreferencesForm
            defaultDailyEnabled={preferences?.dailyEnabled ?? true}
            unsubscribedAt={
              preferences?.unsubscribedAt ? preferences.unsubscribedAt.toISOString() : null
            }
            resetLocal={reset.local}
            resetUtc={reset.utc}
            resetTomorrow={reset.tomorrow}
          />
        </CardContent>
      </Card>

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
                  <TableHead>{t("languages")}</TableHead>
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
          {groupedQuizzes.size === 0 ? (
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
                {Array.from(groupedQuizzes.entries()).flatMap(([classroomId, group]) =>
                  group.quizzes.map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{group.classroomName}</TableCell>
                      <TableCell>
                        <Link className="text-muted-foreground hover:underline" href={`/classrooms/${classroomId}/quiz/${quiz.id}`}>
                          {format.dateTime(new Date(`${quiz.quizDate}T00:00:00`), {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
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
                  )),
                )}
              </TableBody>
            </Table>
          )}
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

      <Card>
        <CardContent>
          <h2 className="font-heading text-xl font-semibold">{t("dataSection")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("exportBlurb")}</p>
          <Button asChild variant="outline" className="mt-3">
            <a href="/api/me/export">{t("exportButton")}</a>
          </Button>
          <div className="mt-4 border-t border-border pt-4">
            <DeleteAccount />
          </div>
        </CardContent>
      </Card>

      {process.env.NODE_ENV !== "production" ? (
        <Card>
          <CardContent>
            <h2 className="font-heading text-xl font-semibold">{t("subscriptionSection")}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{t("free")}</Badge>
              <p className="text-sm text-muted-foreground">{t("billingOff")}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
