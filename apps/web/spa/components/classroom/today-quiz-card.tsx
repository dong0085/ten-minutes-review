import type { ReactNode } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "use-intl";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@tmr/ui/components/button";
import { CtaIcon } from "@tmr/ui/components/cta-icon";
import { cn } from "@tmr/ui/utils";
import type { ClassroomOverview } from "@/spa/lib/queries";
import { PEEK_SPRING, usePeek } from "@/spa/lib/use-peek";
import { QuizMailbox, type MailboxSheet } from "./quiz-mailbox";

type Scene = {
  /** The handwritten line above the mailbox. */
  headline: string;
  /** Small print under the headline. */
  detail: string | null;
  sheet: MailboxSheet;
  /** Where the whole card leads; null leaves it as a plain card. */
  href: { to: string } | { href: string } | null;
  action: ReactNode;
  /** Shows today's date under the button, for a quiz that exists. */
  dated: boolean;
};

/**
 * Today's daily quiz as a mailbox in the middle of the card. When there is
 * somewhere to go, the whole card is one link: hovering or focusing it slides
 * the sheet out, raises the flag, and lifts the button. On-demand practice
 * lives in the quizzes section below, so this card is only about today.
 */
export function TodayQuizCard({
  classroomId,
  today,
  dailyQuizId,
  dailyReview,
  bankSize,
  pendingUploads,
  minutes,
  paused,
  isGuest,
  resetLocal,
  resetUtc,
  resetTomorrow,
}: {
  classroomId: string;
  /** Today in the learner's timezone, as YYYY-MM-DD. */
  today: string;
  dailyQuizId: string | null;
  dailyReview: ClassroomOverview["dailyReview"];
  bankSize: number;
  pendingUploads: number;
  minutes: number;
  paused: boolean;
  isGuest: boolean;
  resetLocal: string;
  resetUtc: string;
  resetTomorrow: boolean;
}) {
  const t = useTranslations("Classroom.TodayQuiz");
  const tHome = useTranslations("Classroom.HomePage");
  const tLength = useTranslations("Classroom.QuizLength");
  const format = useFormatter();
  const peek = usePeek();
  const date = new Date(`${today}T00:00:00Z`);
  const base = `/classrooms/${classroomId}`;
  const nextDelivery = resetTomorrow
    ? t("resetAtTomorrow", { local: resetLocal, utc: resetUtc })
    : t("resetAt", { local: resetLocal, utc: resetUtc });

  const scene: Scene = dailyReview
    ? {
        headline: t("doneLine"),
        detail: paused ? null : nextDelivery,
        sheet: "done",
        href: {
          to: `${base}/quizzes/${dailyReview.quizId}/attempts/${dailyReview.attemptId}`,
        },
        action: (
          <>
            <CtaIcon kind="review" />
            {t("reviewResults")}
          </>
        ),
        dated: true,
      }
    : dailyQuizId
      ? {
          headline: t("readyLine"),
          detail: tLength("minutes", { minutes }),
          sheet: "waiting",
          href: { to: `${base}/quizzes/${dailyQuizId}/take` },
          action: (
            <>
              {t("open")}
              <motion.span
                className="inline-flex"
                variants={{ rest: { x: 0 }, open: { x: 4 } }}
                transition={PEEK_SPRING}
              >
                <ArrowRight />
              </motion.span>
            </>
          ),
          dated: true,
        }
      : bankSize === 0
        ? pendingUploads > 0
          ? {
              headline: t("processingLine"),
              detail: t("processing"),
              sheet: "none",
              href: null,
              action: null,
              dated: false,
            }
          : {
              headline: t("emptyLine"),
              detail: t("empty"),
              sheet: "none",
              href: { to: `${base}/notes/new` },
              action: (
                <>
                  <CtaIcon kind="notes" />
                  {t("addNotes")}
                </>
              ),
              dated: false,
            }
        : isGuest
          ? {
              headline: tHome("guestDailyQuizTitle"),
              detail: tHome("guestDailyQuizBlurb"),
              sheet: "none",
              href: { href: "/signup" },
              action: tHome("guestDailyQuizCta"),
              dated: false,
            }
          : paused
            ? {
                headline: t("pausedLine"),
                detail: t("paused"),
                sheet: "none",
                href: { to: `${base}/settings` },
                action: t("pausedAction"),
                dated: false,
              }
            : {
                headline: t("idleLine"),
                detail: nextDelivery,
                sheet: "none",
                href: null,
                action: null,
                dated: false,
              };

  const content = (
    <div className="flex h-full flex-col items-center px-6 pt-7 pb-6 text-center sm:px-8">
      <p className="font-hand text-3xl leading-tight font-bold text-primary sm:text-4xl">
        {scene.headline}
      </p>
      {scene.detail ? (
        <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
          {scene.detail}
        </p>
      ) : null}
      <div className="mt-4">
        <QuizMailbox
          date={date}
          sheet={scene.sheet}
          score={
            dailyReview
              ? `${dailyReview.correctCount}/${dailyReview.questionCount}`
              : undefined
          }
        />
      </div>
      {scene.action ? (
        <span
          className={cn(
            buttonVariants({
              size: "lg",
              variant: scene.href ? "default" : "outline",
            }),
            "mt-5 min-w-36",
            scene.href &&
              "group-hover:-translate-y-px group-hover:bg-primary/90 group-hover:shadow-[0_2px_2px_rgb(var(--shadow-colour)/0.1),0_8px_18px_rgb(var(--shadow-colour)/0.1)]",
            !scene.href && "pointer-events-none opacity-80",
          )}
        >
          {scene.action}
        </span>
      ) : null}
      {scene.dated ? (
        <p className="mt-3 font-hand text-2xl leading-none text-muted-foreground">
          {format.dateTime(date, {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}
        </p>
      ) : null}
    </div>
  );

  const linkClass =
    "group block h-full rounded-[1.6rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/40";

  return (
    <motion.section
      {...(scene.href ? peek : { initial: "rest", animate: "rest" })}
      variants={{ rest: { y: 0 }, open: { y: -3 } }}
      transition={PEEK_SPRING}
      className={cn(
        "editorial-surface overflow-hidden rounded-[1.6rem] transition-shadow",
        scene.href &&
          "hover:shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.05),0_22px_64px_rgb(var(--shadow-colour)/0.11)]",
      )}
    >
      {scene.href === null ? (
        content
      ) : "to" in scene.href ? (
        <Link to={scene.href.to} className={linkClass}>
          {content}
        </Link>
      ) : (
        <a href={scene.href.href} className={linkClass}>
          {content}
        </a>
      )}
    </motion.section>
  );
}
