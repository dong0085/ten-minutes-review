import { createContext, use, type ReactNode } from "react";
import { motion, type Transition, type Variants } from "motion/react";
import { cn } from "@tmr/ui/utils";

/** Seconds between one question's marks and the next. */
const MARK_STEP = 0.06;
/** The last question that waits its turn; later ones land together. */
export const LAST_MARK = 12;

/**
 * Seconds after mount before the first mark lands. On a handed-back paper the
 * sheet drops in first; a single question marked in place can start at once.
 */
export const MarksStart = createContext(0.7);

function useMarkDelay(order = 0) {
  return use(MarksStart) + Math.min(order, LAST_MARK) * MARK_STEP;
}

const POP: Variants = {
  hidden: { opacity: 0, scale: 1.8 },
  shown: { opacity: 1, scale: 1 },
};


/** A red-pen note that lands on the paper with a small bounce. */
export function PopMark({
  as = "span",
  order = 0,
  className,
  children,
  "aria-hidden": ariaHidden,
}: {
  as?: "span" | "p";
  order?: number;
  className?: string;
  children?: ReactNode;
  "aria-hidden"?: boolean;
}) {
  const Tag = as === "p" ? motion.p : motion.span;
  const delay = useMarkDelay(order);
  return (
    <Tag
      aria-hidden={ariaHidden}
      variants={POP}
      initial="hidden"
      animate="shown"
      transition={{ type: "spring", stiffness: 420, damping: 20, delay }}
      // Transforms skip inline boxes, so a span mark becomes inline-block.
      className={as === "span" ? cn("inline-block", className) : className}
    >
      {children}
    </Tag>
  );
}

const draw = (delay: number, duration = 0.28): Transition => ({
  pathLength: { delay, duration, ease: [0.3, 0, 0.2, 1] },
  opacity: { delay, duration: 0.01 },
});

/** A tick or a cross, drawn stroke by stroke like a teacher's pen. */
export function PenMark({
  correct,
  order = 0,
  className,
}: {
  correct: boolean;
  order?: number;
  className?: string;
}) {
  const start = useMarkDelay(order);
  const stroke = {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-10 -rotate-12", className)}
    >
      {correct ? (
        <motion.path d="M4 12.5 9 17.5 20 6" {...stroke} transition={draw(start, 0.34)} />
      ) : (
        <>
          <motion.path d="M18 6 6 18" {...stroke} transition={draw(start, 0.2)} />
          <motion.path d="M6 6 18 18" {...stroke} transition={draw(start + 0.22, 0.2)} />
        </>
      )}
    </svg>
  );
}

/** The loop a teacher draws around the right choice. */
export function PenCircle({ order = 0, className }: { order?: number; className?: string }) {
  const delay = useMarkDelay(order);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      className={cn("pointer-events-none absolute -inset-1.5 overflow-visible", className)}
    >
      <motion.path
        // One lap and a little overshoot, so the pen visibly closes the loop.
        d="M 58 3 C 88 5 99 30 98 52 C 97 78 74 98 48 97 C 20 96 2 76 3 49 C 4 22 24 3 52 4 C 60 4 66 6 70 9"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={draw(delay, 0.45)}
      />
    </svg>
  );
}

/** A stamp slammed onto the paper; by default once every question is marked. */
export function ScoreStamp({
  after = LAST_MARK,
  tilt = -6,
  className,
  children,
}: {
  /** The mark order it waits for. */
  after?: number;
  /** Degrees it settles at; zero when its class already tilts it. */
  tilt?: number;
  className?: string;
  children: ReactNode;
}) {
  const delay = useMarkDelay(after) + 0.35;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 2.6, rotate: tilt - 12 }}
      animate={{ opacity: 1, scale: 1, rotate: tilt }}
      transition={{ type: "spring", stiffness: 520, damping: 17, delay }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.span>
  );
}
