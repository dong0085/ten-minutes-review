import type { ReactNode } from "react";
import { cn } from "../utils";

type CtaIconKind = "signup" | "notes" | "generate" | "submit" | "pro" | "billing" | "review" | "retake";

const drawings: Record<CtaIconKind, ReactNode> = {
  signup: (
    <>
      <circle cx="9" cy="7" r="3.5" className="cta-icon-wash" />
      <path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2" />
      <circle cx="19" cy="12" r="4.5" className="cta-icon-wash" stroke="none" />
      <path d="M19 9.5v5M16.5 12h5" className="cta-icon-accent" />
    </>
  ),
  notes: (
    <>
      <rect x="4" y="3" width="13" height="18" rx="2" className="cta-icon-wash" />
      <path d="M7.5 3v18M2.5 7H5M2.5 12H5M2.5 17H5M10.5 7H14M10.5 11H13" />
      <path d="m13 16 6-6 2.5 2.5-6 6-3.5 1z" className="cta-icon-detail" />
      <path d="m17.5 11.5 2.5 2.5" />
    </>
  ),
  generate: (
    <>
      <path d="m10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5z" className="cta-icon-wash" />
      <path d="M20 2v5M17.5 4.5h5M20.5 17v4M18.5 19h4" className="cta-icon-accent" />
    </>
  ),
  submit: (
    <>
      <path d="M14 2.5H5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" className="cta-icon-wash" />
      <path d="M14 2.5v5h5M6.5 8H10" />
      <path d="m7 15 3 3 8-8" className="cta-icon-accent" strokeWidth="2.2" />
    </>
  ),
  pro: (
    <>
      <path d="m12 2 3 2 3.5.5.5 3.5 2 4-2 3-.5 3.5-3.5.5-3 2-4-2-3.5-.5L4 15l-2-3 2-4 .5-3.5L8 4z" className="cta-icon-wash" />
      <path d="m12 6 1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5z" className="cta-icon-accent" />
    </>
  ),
  billing: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" className="cta-icon-wash" />
      <path d="M2 9h20" className="cta-icon-accent" strokeWidth="3" />
      <path d="M6 15h3M12 15h2" />
    </>
  ),
  review: (
    <>
      <path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1z" className="cta-icon-wash" />
      <path d="M12 5v15M5 8h3M5 12h3" />
      <path d="m15 11 2 2 3-4" className="cta-icon-accent" />
    </>
  ),
  retake: (
    <>
      <circle cx="12" cy="12" r="8" className="cta-icon-wash" stroke="none" />
      <path d="M3 10a9 9 0 1 1 2.5 9M3 4v6h6" className="cta-icon-accent" />
    </>
  ),
};

/** Small stationery drawings; the button's foreground keeps the ink legible. */
export function CtaIcon({ kind, className }: { kind: CtaIconKind; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-kind={kind}
      data-icon="inline-start"
      className={cn("cta-icon size-[1.125rem] shrink-0", className)}
    >
      {drawings[kind]}
    </svg>
  );
}
