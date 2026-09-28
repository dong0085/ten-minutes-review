import { motion } from "motion/react";
import { useFormatter } from "use-intl";
import { PEEK_SPRING } from "@/lib/use-peek";

/**
 * Today's quiz waiting in a letterbox. It follows the "rest" and "open"
 * variants of its parent, so the sheet slides out and the flag rises when the
 * card is hovered or focused.
 */
export function QuizMailbox({ date }: { date: Date }) {
  const format = useFormatter();
  return (
    <div aria-hidden="true" className="relative h-36 w-26">
      {/* Back wall of the box. */}
      <div className="absolute inset-x-0 bottom-0 h-16 rounded-lg bg-[color-mix(in_oklch,var(--primary),black_25%)]" />
      {/* The quiz sheet, dated like a letter. */}
      <motion.div
        variants={{ rest: { y: 32, rotate: -1.5 }, open: { y: -20, rotate: -5 } }}
        transition={PEEK_SPRING}
        className="absolute inset-x-2.5 bottom-6 h-28 origin-bottom rounded-sm bg-card shadow-[0_1px_3px_rgb(var(--shadow-colour)/0.12)]"
      >
        <div className="flex items-baseline justify-between border-b border-dashed border-border px-2 pt-1.5 pb-1">
          <span className="text-[0.55rem] font-bold tracking-[0.16em] text-primary uppercase">
            {format.dateTime(date, { month: "short", timeZone: "UTC" })}
          </span>
          <span className="font-heading text-lg leading-none font-semibold tabular-nums">
            {format.dateTime(date, { day: "numeric", timeZone: "UTC" })}
          </span>
        </div>
        <div className="space-y-1.5 px-2 pt-2">
          <span className="block h-1 w-4/5 rounded-full bg-foreground/15" />
          <span className="block h-1 w-3/5 rounded-full bg-foreground/10" />
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full border border-primary/60" />
            <span className="h-1 w-1/2 rounded-full bg-foreground/10" />
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-primary/60" />
            <span className="h-1 w-2/5 rounded-full bg-foreground/10" />
          </span>
        </div>
      </motion.div>
      {/* Front of the box. */}
      <div className="absolute inset-x-0 bottom-0 h-14 rounded-lg bg-primary shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.1),0_12px_24px_rgb(var(--shadow-colour)/0.14)]">
        <span className="absolute inset-x-4 top-2 h-1 rounded-full bg-black/20" />
        <p className="pt-5 text-center text-[0.6rem] font-bold tracking-[0.2em] text-primary-foreground/85 uppercase">
          {format.dateTime(date, { weekday: "short", timeZone: "UTC" })}
        </p>
      </div>
      {/* The flag rises a beat after the sheet starts moving. */}
      <motion.span
        variants={{
          rest: { rotate: 90, transition: PEEK_SPRING },
          open: { rotate: 0, transition: { ...PEEK_SPRING, delay: 0.08 } },
        }}
        className="absolute -right-1 bottom-7 h-8 w-1 origin-bottom rounded-full bg-destructive after:absolute after:top-0 after:left-1 after:h-2.5 after:w-3 after:rounded-r-sm after:bg-destructive"
      />
    </div>
  );
}
