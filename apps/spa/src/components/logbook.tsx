import type { ReactNode } from "react";
import { Link } from "react-router";
import { useFormatter } from "use-intl";
import { ChevronRight } from "lucide-react";
import { cn } from "@tmr/ui/utils";

// Ruled logbook list: the date sits in a red-ruled margin, the best score is
// circled on the right. Used for quiz lists on the account and classroom pages.
export function Logbook({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("logbook", className)}>{children}</ol>;
}

export function LogbookRow({
  href,
  quizDate,
  title,
  meta,
  score,
  size,
  pending,
}: {
  href: string;
  /** A calendar day (YYYY-MM-DD). */
  quizDate: string;
  title: ReactNode;
  meta: ReactNode;
  score: number | null;
  size: number;
  /** Shown in place of the score when the quiz has no attempt yet. */
  pending: ReactNode;
}) {
  const format = useFormatter();
  // quizDate is a calendar day, so format it in UTC to keep the same day.
  const day = new Date(`${quizDate}T00:00:00Z`);
  const ratio = score !== null && size > 0 ? score / size : null;

  return (
    <li className="border-b border-primary/10 last:border-b-0">
      <Link
        to={href}
        className="group flex items-center gap-4 py-3 pr-4 transition-colors hover:bg-primary/[0.04] sm:pr-6"
      >
        <span className="flex w-[4.25rem] shrink-0 flex-col items-center leading-none">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {format.dateTime(day, { day: "numeric", timeZone: "UTC" })}
          </span>
          <span className="mt-1 text-[0.62rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {format.dateTime(day, { month: "short", timeZone: "UTC" })}
          </span>
        </span>
        <span className="min-w-0 flex-1 pl-2">
          <span className="flex min-w-0 items-center gap-2 font-medium">{title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {format.dateTime(day, { weekday: "long", timeZone: "UTC" })} · {meta}
          </span>
        </span>
        {ratio !== null ? (
          <span
            className={cn(
              "marker-loop shrink-0 px-1.5 font-heading text-lg font-semibold tabular-nums",
              ratio >= 0.8 ? "text-success" : ratio >= 0.6 ? "text-primary" : "text-warning",
            )}
          >
            {score}/{size}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
            {pending}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
