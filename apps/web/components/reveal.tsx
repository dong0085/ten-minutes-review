"use client";

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Element to render; it stays the direct grid child so layout is unchanged. */
  as?: "div" | "article" | "section";
  /** Stagger delay in milliseconds once the element enters the viewport. */
  delay?: number;
  /** Direction the element drifts in from. */
  from?: "bottom" | "right";
};

export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  from = "bottom",
}: RevealProps) {
  const Tag = as as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={className}
      data-reveal={shown ? "shown" : "hidden"}
      data-reveal-from={from}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
