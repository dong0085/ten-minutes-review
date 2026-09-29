import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@tmr/ui/utils";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {kicker ? <p className="eyebrow">{kicker}</p> : null}
        <h1 className={cn("font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl", kicker && "mt-2")}>
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type DrillItem = {
  to: string;
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
};

/** A list of places one level deeper. Each row is one tap to a focused screen. */
export function DrillList({ items, className }: { items: DrillItem[]; className?: string }) {
  return (
    <ul
      className={cn(
        "divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/75 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.035)]",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-primary/[0.04] sm:px-5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary">
                <Icon className="size-4 transition-transform duration-200 group-hover:-rotate-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.title}</span>
                {item.meta ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.meta}</span>
                ) : null}
              </span>
              {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="font-heading text-xl font-semibold tracking-[-0.02em]">{children}</h2>
      {action}
    </div>
  );
}
