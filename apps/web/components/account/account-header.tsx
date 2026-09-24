import type { ReactNode } from "react";

// Page heading: the last word of the title gets a highlighter swipe.
export function AccountHeader({
  kicker,
  title,
  description,
  aside,
}: {
  kicker: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  const words = title.split(" ");
  const last = words.pop();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          {words.length > 0 ? `${words.join(" ")} ` : null}
          <span className="marker-swipe">{last}</span>
        </h1>
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

// Section heading used inside the stationery cards.
export function SectionTitle({
  kicker,
  title,
  aside,
}: {
  kicker?: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        {kicker ? <p className="eyebrow">{kicker}</p> : null}
        <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}
