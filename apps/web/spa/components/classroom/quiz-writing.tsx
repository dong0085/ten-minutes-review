import { motion } from "motion/react";
import { cn } from "@tmr/ui/utils";
import { PencilIcon } from "@/spa/components/pencil-icon";

/** Line widths on the sheet, as a share of the writing width. */
const LINES = [0.82, 0.64, 0.9, 0.5, 0.74];
const LINE_SECONDS = 0.7;
const PAUSE_SECONDS = 0.9;

/**
 * Lines being written one by one on a sheet, with a pencil tip following
 * each line. Its parent is the sheet; the pixel geometry places the lines.
 */
export function WritingLines({
  width,
  left,
  firstLine,
  lineGap,
  lines = LINES.length,
  pencil = 20,
}: {
  /** Width of the widest possible line, in pixels. */
  width: number;
  left: number;
  firstLine: number;
  lineGap: number;
  lines?: number;
  pencil?: number;
}) {
  const shares = LINES.slice(0, lines);
  const cycle = shares.length * LINE_SECONDS + PAUSE_SECONDS;
  const at = (seconds: number) => seconds / cycle;
  const loop = { duration: cycle, ease: "easeInOut", repeat: Infinity } as const;

  // The pencil tip runs along each line, then hops back for the next one.
  const times: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  shares.forEach((share, index) => {
    times.push(at(index * LINE_SECONDS), at((index + 1) * LINE_SECONDS));
    x.push(0, share * width);
    y.push(index * lineGap, index * lineGap);
  });
  times.push(0.96, 1);
  x.push(x.at(-1) ?? 0, 0);
  y.push(y.at(-1) ?? 0, 0);

  return (
    <>
      {/* Each line is written in its turn, then the page clears at the end of the cycle. */}
      {shares.map((share, index) => (
        <motion.span
          key={index}
          className="absolute h-1 origin-left rounded-full bg-foreground/25"
          style={{ left, top: firstLine + index * lineGap, width: share * width }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 0, 1, 1, 0] }}
          transition={{
            ...loop,
            times: [0, at(index * LINE_SECONDS), at((index + 1) * LINE_SECONDS), 0.96, 1],
          }}
        />
      ))}
      <motion.span
        className="absolute text-primary"
        style={{
          left: left - pencil * 0.06,
          top: firstLine + 2 - pencil * 0.94,
          width: pencil,
          height: pencil,
        }}
        initial={{ x: 0, y: 0 }}
        animate={{ x, y }}
        transition={{ ...loop, times }}
      >
        <PencilIcon className="size-full" />
      </motion.span>
    </>
  );
}

/** A quiz sheet being written line by line while the worker composes. */
export function QuizWriting({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto h-32 w-32", className)}>
      <div className="absolute inset-0 rotate-[-2deg] rounded-md border border-border/70 bg-card shadow-[0_2px_4px_rgb(var(--shadow-colour)/0.06),0_12px_24px_rgb(var(--shadow-colour)/0.1)]">
        <span className="absolute top-3.5 left-3 h-1.5 w-10 rounded-full bg-primary/70" />
        <WritingLines width={104} left={12} firstLine={34} lineGap={14} />
      </div>
    </div>
  );
}
