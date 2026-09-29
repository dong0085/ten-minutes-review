import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/** A number that rolls from where it was to its new value. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const count = useMotionValue(reduce ? value : 0);
  const shown = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    if (reduce) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.8, ease: [0.2, 0.7, 0.2, 1] });
    return () => controls.stop();
  }, [count, reduce, value]);

  return <motion.span className={className}>{shown}</motion.span>;
}
