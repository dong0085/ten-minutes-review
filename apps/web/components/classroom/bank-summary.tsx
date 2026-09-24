import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, type Category } from "@tmr/core";

// The question bank as a card-catalog cabinet: one drawer per category with
// a label holder, a brass pull, and index cards peeking out by volume.
export async function BankSummary({
  counts,
  manageHref,
}: {
  counts: { category: Category; value: number }[];
  manageHref?: string;
}) {
  const t = await getTranslations("Classroom.BankSummary");
  const categoryT = await getTranslations("Category");
  const values = new Map(counts.map((row) => [row.category, row.value]));
  const total = counts.reduce((sum, row) => sum + row.value, 0);
  const largest = Math.max(1, ...counts.map((row) => row.value));

  return (
    <section className="editorial-surface overflow-hidden rounded-[1.6rem]">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 sm:px-8">
        <div>
          <p className="eyebrow">{t("kicker")}</p>
          <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.02em]">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? t("empty") : t("total", { count: total })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <strong className="font-heading text-5xl font-semibold tracking-[-0.04em] tabular-nums text-primary">
            {total}
          </strong>
          {manageHref ? (
            <Link
              href={manageHref}
              className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t("manage")}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Cabinet body: wooden-toned frame holding five drawers. */}
      <div className="mt-6 border-t border-border/70 bg-muted/45 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((category) => {
            const value = values.get(category) ?? 0;
            // Up to five index cards peek out of a drawer, by relative volume.
            const peeking = value === 0 ? 0 : Math.max(1, Math.round((value / largest) * 5));
            return (
              <div
                key={category}
                className="drawer group relative flex flex-col items-center rounded-lg border border-border/80 px-3 pt-5 pb-3 text-center transition-transform duration-200 hover:-translate-y-1"
              >
                {/* Index cards sticking up out of the drawer. */}
                <span aria-hidden="true" className="absolute inset-x-4 -top-2 flex justify-center gap-0.5">
                  {Array.from({ length: peeking }, (_, index) => (
                    <span
                      key={index}
                      className="h-3 w-3.5 rounded-t-[3px] border border-b-0 border-border bg-card transition-transform duration-200 group-hover:-translate-y-0.5"
                      style={{ transitionDelay: `${index * 30}ms` }}
                    />
                  ))}
                </span>
                {/* Label holder. */}
                <dt className="w-full truncate rounded-[4px] border border-foreground/15 bg-card px-2 py-1 text-[0.68rem] font-semibold tracking-[0.04em] text-muted-foreground shadow-[inset_0_1px_1px_rgb(var(--shadow-colour)/0.06)]">
                  {categoryT(category)}
                </dt>
                <dd className="mt-2 font-heading text-3xl font-semibold tabular-nums">{value}</dd>
                {/* Brass pull. */}
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-8 rounded-full border border-warning/40 bg-warning/25"
                />
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
