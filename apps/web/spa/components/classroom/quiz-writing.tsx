import { motion } from "motion/react";
import { PencilIcon } from "@/spa/components/pencil-icon";

/** Line widths on the sheet, as a share of the writing width. */
const LINES = [0.82, 0.64, 0.9, 0.5, 0.74];
const LINE_SECONDS = 0.7;
const PAUSE_SECONDS = 0.9;
const CYCLE = LINES.length * LINE_SECONDS + PAUSE_SECONDS;
/** Pixel geometry of the sheet, so the pencil tip can follow each line. */
const WIDTH = 104;
const FIRST_LINE = 34;
const LINE_GAP = 14;
const PENCIL = 20;

const at = (seconds: number) => seconds / CYCLE;

// Each line is written in its turn, then the page clears at the end of the cycle.
const lineFrames = LINES.map((_, index) => ({
  times: [0, at(index * LINE_SECONDS), at((index + 1) * LINE_SECONDS), 0.96, 1],
  values: [0, 0, 1, 1, 0],
}));

// The pencil tip runs along each line, then hops back for the next one.
const pencilFrames = (() => {
  const times: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  LINES.forEach((width, index) => {
    times.push(at(index * LINE_SECONDS), at((index + 1) * LINE_SECONDS));
    x.push(0, width * WIDTH);
    y.push(index * LINE_GAP, index * LINE_GAP);
  });
  times.push(0.96, 1);
  x.push(x.at(-1) ?? 0, 0);
  y.push(y.at(-1) ?? 0, 0);
  return { times, x, y };
})();

/** A quiz sheet being written line by line while the worker composes. */
export function QuizWriting() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-32 w-32">
      <div className="absolute inset-0 rotate-[-2deg] rounded-md border border-border/70 bg-card shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.06),0_12px_24px_rgb(var(--shadow-colour)/0.1)]">
        <span className="absolute top-3.5 left-3 h-1.5 w-10 rounded-full bg-primary/70" />
        {LINES.map((width, index) => (
          <motion.span
            key={index}
            className="absolute left-3 h-1 origin-left rounded-full bg-foreground/25"
            style={{ top: FIRST_LINE + index * LINE_GAP, width: width * WIDTH }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: lineFrames[index]!.values }}
            transition={{
              duration: CYCLE,
              times: lineFrames[index]!.times,
              ease: "easeInOut",
              repeat: Infinity,
            }}
          />
        ))}
        <motion.span
          className="absolute text-primary"
          style={{ left: 12 - PENCIL * 0.06, top: FIRST_LINE + 2 - PENCIL * 0.94 }}
          initial={{ x: 0, y: 0 }}
          animate={{ x: pencilFrames.x, y: pencilFrames.y }}
          transition={{
            duration: CYCLE,
            times: pencilFrames.times,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          <PencilIcon className="size-5" />
        </motion.span>
      </div>
    </div>
  );
}
