import { cn } from "@tmr/ui/utils";

// The landing page is server-rendered, so this is a plain link out of the SPA.
export function BrandMark({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={cn(
        "group inline-flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="sr-only">Ten Minutes Review</span>
      <img
        src="/icon.png"
        alt=""
        aria-hidden="true"
        className="size-8 rounded-[0.65rem] transition-transform duration-200 group-hover:-rotate-2"
      />
    </a>
  );
}
