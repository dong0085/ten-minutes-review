import { useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { motion } from "motion/react";

const depth = (pathname: string) => pathname.split("/").filter(Boolean).length;

/**
 * Eases each screen in as the learner drills down or climbs back up: deeper
 * screens arrive from the right, shallower ones from the left.
 */
export function ScreenTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [previous, setPrevious] = useState(pathname);
  const [direction, setDirection] = useState(0);
  if (previous !== pathname) {
    setDirection(depth(pathname) >= depth(previous) ? 1 : -1);
    setPrevious(pathname);
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, x: direction * 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      {children}
    </motion.div>
  );
}
