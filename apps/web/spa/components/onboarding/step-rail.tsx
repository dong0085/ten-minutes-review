import { motion } from "motion/react";
import { cn } from "@tmr/ui/utils";

/** Three ink lines that draw themselves in as the user moves through the steps. */
export function StepRail({
  current,
  started,
  labels,
}: {
  current: number;
  started: boolean;
  labels: string[];
}) {
  return (
    <ol className="mx-auto flex max-w-md items-start gap-2">
      {labels.map((label, index) => {
        const reached = started && index <= current;
        return (
          <li key={label} className="min-w-0 flex-1" aria-current={reached && index === current ? "step" : undefined}>
            <div className="h-[3px] overflow-hidden rounded-full bg-border/80">
              <motion.div
                className="h-full origin-left rounded-full bg-primary"
                initial={false}
                animate={{ scaleX: reached ? 1 : 0 }}
                transition={{ duration: 0.55, ease: [0.3, 0, 0.2, 1], delay: reached ? 0.15 : 0 }}
              />
            </div>
            <p
              className={cn(
                "mt-1.5 truncate text-[0.7rem] font-medium tracking-wide transition-colors duration-300",
                reached ? "text-foreground" : "text-muted-foreground/70",
                index !== current && "max-sm:sr-only",
              )}
            >
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
