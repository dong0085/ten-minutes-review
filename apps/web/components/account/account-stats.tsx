import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, NotebookPen } from "lucide-react";
import type { ActivityStats, AttemptScore, LearningStats, RecentMiss } from "@tmr/db";
import { SectionTitle } from "@/components/account/account-header";
import { Button } from "@/components/ui/button";
import { formatDurationMs } from "@/lib/format";
import { cn } from "@/lib/utils";

function percent(correct: number, answered: number): number {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0;
}

// Tally marks in groups of five, the fifth striking through the first four.
function Tally({ count }: { count: number }) {
  const groups = Array.from({ length: Math.ceil(count / 5) }, (_, index) =>
    Math.min(5, count - index * 5),
  );
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-1" aria-hidden="true">
      {groups.map((size, index) => (
        <svg key={index} viewBox="0 0 30 22" className="h-5 w-7 text-primary">
          {Array.from({ length: Math.min(size, 4) }, (_, stroke) => (
            <path
              key={stroke}
              d={`M${4 + stroke * 6} 3 L${3.4 + stroke * 6} 19`}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
          {size === 5 ? (
            <path d="M1 16 L27 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : null}
        </svg>
      ))}
    </span>
  );
}

// The overall accuracy, circled in the margin like a teacher's grade.
function GradeCircle({ value }: { value: number }) {
  const tone = value >= 80 ? "text-success" : value >= 60 ? "text-primary" : "text-warning";
  return (
    <div className={cn("relative grid size-32 place-items-center", tone)}>
      <svg viewBox="0 0 120 120" className="absolute inset-0" aria-hidden="true">
        <path
          d="M60 8 C 92 6, 114 30, 112 62 C 110 94, 84 114, 56 112 C 26 110, 6 88, 9 57 C 12 28, 34 10, 66 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      <span className="font-heading text-4xl font-semibold tracking-[-0.04em] tabular-nums">
        {value}
        <span className="text-xl">%</span>
      </span>
    </div>
  );
}

function Trend({ attempts }: { attempts: AttemptScore[] }) {
  const points = attempts.map((attempt, index) => {
    const x = attempts.length === 1 ? 50 : 4 + (index / (attempts.length - 1)) * 92;
    const ratio = attempt.questionCount > 0 ? attempt.correctCount / attempt.questionCount : 0;
    return { x, y: 54 - ratio * 48 };
  });
  const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `4,58 ${line} 96,58`;
  return (
    <svg viewBox="0 0 100 60" className="h-auto w-full text-primary" aria-hidden="true">
      <polygon points={area} fill="currentColor" opacity="0.1" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 2.6 : 1.7}
          fill={index === points.length - 1 ? "currentColor" : "var(--card)"}
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

// Overview "report card": the grade, the tally of study days, the trend on
// graph paper, highlighter bars per category, and recent misses as flashcards.
export async function AccountStats({
  activity,
  learning,
  attempts,
  misses,
}: {
  activity: ActivityStats;
  learning: LearningStats;
  attempts: AttemptScore[];
  misses: RecentMiss[];
}) {
  const t = await getTranslations("Account.Stats");
  const categoryT = await getTranslations("Category");
  const locale = await getLocale();

  if (activity.attemptCount === 0) {
    return (
      <section className="editorial-surface paper-lines relative overflow-hidden rounded-[1.6rem] px-6 py-10 text-center sm:px-10">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/[0.09] text-primary">
          <NotebookPen className="size-5" />
        </span>
        <p className="eyebrow mt-5">{t("kicker")}</p>
        <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.02em]">
          {t("emptyTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("empty")}</p>
        <Button asChild className="mt-6">
          <Link href="/classrooms">
            {t("goToClassrooms")}
            <ArrowRight />
          </Link>
        </Button>
      </section>
    );
  }

  const accuracy = percent(activity.correctCount, activity.answeredCount);
  const figures = [
    { label: t("quizzesTaken"), value: String(activity.quizCount) },
    { label: t("questionsAnswered"), value: String(activity.answeredCount) },
    { label: t("timeStudied"), value: formatDurationMs(activity.totalDurationMs, locale) },
  ];

  const categories = [...learning.categories].sort(
    (a, b) => percent(a.correct, a.answered) - percent(b.correct, b.answered),
  );
  const weakest = categories[0];

  const { bankPoints, masteredPoints, practicedPoints } = learning;
  const learningPoints = Math.max(0, practicedPoints - masteredPoints);
  const unseenPoints = Math.max(0, bankPoints - practicedPoints);
  const share = (value: number) => (bankPoints > 0 ? (value / bankPoints) * 100 : 0);

  return (
    <section className="editorial-surface overflow-hidden rounded-[1.6rem]">
      <div className="px-6 pt-6 sm:px-8">
        <SectionTitle kicker={t("kicker")} title={t("title")} />
      </div>

      {/* Headline: the circled grade and the key figures. */}
      <div className="mt-5 grid gap-6 border-b border-border/70 px-6 pb-7 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:px-8">
        <div className="flex items-center gap-4 sm:flex-col sm:gap-1">
          <GradeCircle value={accuracy} />
          <p className="text-xs font-medium text-muted-foreground">{t("accuracy")}</p>
        </div>
        <div className="space-y-5">
          <dl className="grid grid-cols-3 gap-4">
            {figures.map((figure) => (
              <div key={figure.label}>
                <dd className="font-heading text-2xl font-semibold tracking-[-0.03em] whitespace-nowrap tabular-nums sm:text-3xl">
                  {figure.value}
                </dd>
                <dt className="mt-0.5 text-xs text-muted-foreground">{figure.label}</dt>
              </div>
            ))}
          </dl>
          <div className="rounded-xl border border-dashed border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("activeDaysTally", { count: activity.activeDays })}
              </p>
            </div>
            <div className="mt-2">
              {activity.activeDays > 0 ? (
                <Tally count={activity.activeDays} />
              ) : (
                <p className="text-sm text-muted-foreground">{t("noActiveDays")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2">
        {/* Score trend on graph paper. */}
        <div className="border-b border-border/70 px-6 py-6 sm:px-8 lg:border-r lg:border-b-0">
          <h3 className="text-sm font-semibold">{t("trendTitle")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("trend", { count: attempts.length })}
          </p>
          <div className="graph-paper mt-4 rounded-xl border border-border/60 bg-card/60 p-2">
            {attempts.length >= 2 ? (
              <Trend attempts={attempts} />
            ) : (
              <p className="grid aspect-[5/3] place-items-center text-center text-xs text-muted-foreground">
                {t("trendEmpty")}
              </p>
            )}
          </div>
        </div>

        {/* Knowledge bank: solid, still learning, not seen yet. */}
        <div className="px-6 py-6 sm:px-8">
          <h3 className="text-sm font-semibold">{t("bankTitle")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("bankTotal", { total: bankPoints })}
          </p>
          {bankPoints > 0 ? (
            <>
              <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                <div className="h-full bg-success" style={{ width: `${share(masteredPoints)}%` }} />
                <div className="h-full bg-primary/55" style={{ width: `${share(learningPoints)}%` }} />
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  { label: t("bankSolid"), value: masteredPoints, swatch: "bg-success" },
                  { label: t("bankLearning"), value: learningPoints, swatch: "bg-primary/55" },
                  { label: t("bankUnseen"), value: unseenPoints, swatch: "bg-foreground/[0.1]" },
                ].map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={cn("size-2.5 rounded-full", row.swatch)} />
                      {row.label}
                    </span>
                    <span className="font-medium tabular-nums">{row.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">{t("bankEmpty")}</p>
          )}
        </div>
      </div>

      {/* Highlighter bars per category, weakest first. */}
      <div className="border-t border-border/70 px-6 py-6 sm:px-8">
        <h3 className="text-sm font-semibold">{t("categoryTitle")}</h3>
        {categories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {categories.map((category) => {
              const value = percent(category.correct, category.answered);
              const focus = category === weakest && categories.length > 1 && value < 80;
              return (
                <li key={category.category}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {categoryT(category.category)}
                      {focus ? (
                        <span className="rounded-full bg-warning/12 px-2 py-0.5 text-[0.68rem] font-semibold text-warning">
                          {t("focusHere")}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("categoryMeta", { correct: category.correct, answered: category.answered })}
                      {" · "}
                      <span className="font-semibold text-foreground">{value}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 w-full rounded-full bg-foreground/[0.05]">
                    <div
                      className={cn("highlighter h-full", focus && "bg-warning/45")}
                      style={{ width: `${Math.max(value, 3)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {learning.gaps.length > 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("notPracticed", {
              categories: learning.gaps.map((gap) => categoryT(gap)).join(", "),
            })}
          </p>
        ) : null}
      </div>

      {/* Recent misses as a spread of flashcards. */}
      {misses.length > 0 ? (
        <div className="border-t border-border/70 bg-muted/30 px-6 py-6 sm:px-8">
          <h3 className="text-sm font-semibold">{t("recentMisses")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("recentMissesBlurb")}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {misses.map((miss, index) => (
              <li
                key={miss.knowledgePointId}
                className={cn(
                  "rounded-lg border border-border/80 bg-card px-4 pt-3 pb-4 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.05)] transition-transform duration-200 hover:-translate-y-0.5 hover:rotate-0",
                  index % 3 === 0 ? "-rotate-[0.6deg]" : index % 3 === 1 ? "rotate-[0.5deg]" : "-rotate-[0.3deg]",
                )}
              >
                <p className="border-b border-destructive/30 pb-1.5 text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {categoryT(miss.category)}
                </p>
                <p className="mt-2 text-sm leading-6">{miss.stem}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
