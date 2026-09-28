import { useState, type FocusEvent } from "react";
import type { Transition } from "motion/react";

/** The springy settle every peek animation shares. */
export const PEEK_SPRING: Transition = { type: "spring", stiffness: 320, damping: 17 };

/**
 * Props for a motion element whose children animate between the "rest" and
 * "open" variants while the pointer is over it or focus is inside it.
 */
export function usePeek() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  return {
    initial: "rest",
    animate: hovered || focused ? "open" : "rest",
    onHoverStart: () => setHovered(true),
    onHoverEnd: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setFocused(false);
      }
    },
  };
}
