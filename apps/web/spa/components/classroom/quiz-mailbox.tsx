import { motion } from "motion/react";
import { useFormatter } from "use-intl";
import { cn } from "@tmr/ui/utils";
import { PEEK_SPRING } from "@/spa/lib/use-peek";

/** What sits in the box: today's quiz waiting, today's quiz taken, or nothing yet. */
export type MailboxSheet = "waiting" | "done" | "none";

/** Where the sheet sits, in px, for each state of the card around it. */
const SHEET_VARIANTS = {
  waiting: { rest: { y: 44, rotate: -1.5 }, open: { y: -26, rotate: -5 } },
  done: { rest: { y: -8, rotate: -4 }, open: { y: -22, rotate: -6 } },
};

/**
 * Today's quiz waiting in a letterbox. It follows the "rest" and "open"
 * variants of its parent, so the sheet slides out and the flag rises when the
 * card is hovered or focused. A taken quiz sits out of the box with its score
 * stamped on it; an empty box has no sheet.
 */
export function QuizMailbox({
  date,
  sheet,
  score,
}: {
  date: Date;
  sheet: MailboxSheet;
  /** The stamp on a taken quiz, such as "8/10". */
  score?: string;
}) {
  const format = useFormatter();
  // An empty box needs no headroom for a sheet to slide into.
  return (
    <div
      aria-hidden="true"
      className={cn("relative w-36", sheet === "none" ? "h-28" : "h-48")}
    >
      {/* Back wall of the box. */}
      <div className="absolute inset-x-0 bottom-0 h-[5.25rem] rounded-xl bg-[color-mix(in_oklch,var(--primary),black_25%)]" />
      {/* The quiz sheet, dated like a letter. */}
      {sheet === "none" ? null : (
        <motion.div
          variants={SHEET_VARIANTS[sheet]}
          transition={PEEK_SPRING}
          className="absolute inset-x-3.5 bottom-8 h-[9.5rem] origin-bottom rounded-sm bg-card shadow-[0_1px_3px_rgb(var(--shadow-colour)/0.12)]"
        >
          <div className="flex items-baseline justify-between border-b border-dashed border-border px-2.5 pt-1 pb-0.5">
            <span className="font-hand text-lg leading-none font-semibold whitespace-nowrap text-primary">
              {format.dateTime(date, { month: "short", timeZone: "UTC" })}
            </span>
            {/* The bare number, since some locales add a suffix such as 日. */}
            <span className="font-hand text-4xl leading-none font-bold tabular-nums">
              {date.getUTCDate()}
            </span>
          </div>
          <div className="space-y-2 px-2.5 pt-3">
            <span className="block h-1.5 w-4/5 rounded-full bg-foreground/15" />
            <span className="block h-1.5 w-3/5 rounded-full bg-foreground/10" />
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-primary/60" />
              <span className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary/60" />
              <span className="h-1.5 w-2/5 rounded-full bg-foreground/10" />
            </span>
          </div>
          {sheet === "done" && score ? (
            <span className="ink-stamp absolute top-[3.6rem] right-2 rounded-md px-1.5 font-hand text-2xl leading-tight font-bold text-success tabular-nums">
              {score}
            </span>
          ) : null}
        </motion.div>
      )}
      {/* Front of the box. */}
      <div className="absolute inset-x-0 bottom-0 h-[4.75rem] rounded-xl bg-primary shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.1),0_12px_24px_rgb(var(--shadow-colour)/0.14)]">
        <span className="absolute inset-x-5 top-2.5 h-1.5 rounded-full bg-black/20" />
        <p className="pt-6 text-center font-hand text-2xl leading-none font-bold text-primary-foreground/90">
          {format.dateTime(date, { weekday: "short", timeZone: "UTC" })}
        </p>
      </div>
      {/* The flag rises a beat after the sheet starts moving. */}
      <motion.span
        variants={{
          rest: { rotate: 90, transition: PEEK_SPRING },
          open: {
            rotate: sheet === "waiting" ? 0 : 90,
            transition: { ...PEEK_SPRING, delay: 0.08 },
          },
        }}
        className="absolute -right-1.5 bottom-9 h-11 w-1.5 origin-bottom rounded-full bg-destructive after:absolute after:top-0 after:left-1.5 after:h-3.5 after:w-4 after:rounded-r-sm after:bg-destructive"
      />
    </div>
  );
}
