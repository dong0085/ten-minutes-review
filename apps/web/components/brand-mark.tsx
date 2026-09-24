import Image from "next/image";
import Link from "next/link";
import appIcon from "@/assets/appIcon/ten-minutes-review_icon.png";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="sr-only">Ten Minutes Review</span>
      <Image
        src={appIcon}
        alt=""
        aria-hidden="true"
        preload
        sizes="32px"
        className="size-8 rounded-[0.65rem] transition-transform duration-200 group-hover:-rotate-2"
      />
      <span aria-hidden="true" className="hidden font-heading text-[1.05rem] font-semibold tracking-[-0.025em] sm:inline">
        Ten Minutes Review
      </span>
    </Link>
  );
}
