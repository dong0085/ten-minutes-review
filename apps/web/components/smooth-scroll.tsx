"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import "lenis/dist/lenis.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/* Radix menus and dialogs lock the page by marking <body>; Lenis drives the
   scroll itself, so it pauses while that mark is present. */
function PauseWhileLocked() {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) {
      return;
    }
    const sync = () => {
      if (document.body.hasAttribute("data-scroll-locked")) {
        lenis.stop();
      } else {
        lenis.start();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributeFilter: ["data-scroll-locked"] });
    return () => observer.disconnect();
  }, [lenis]);
  return null;
}

/* Eases wheel and trackpad scrolling on the marketing pages. Touch keeps the
   native scroll, and visitors who ask for reduced motion keep it too. */
export function SmoothScroll() {
  const reducedMotion = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
  if (reducedMotion) {
    return null;
  }
  return (
    <ReactLenis root options={{ lerp: 0.1, anchors: true }}>
      <PauseWhileLocked />
    </ReactLenis>
  );
}
