import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CATEGORIES, type Category } from "@tmr/core";

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
  const barColours = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("kicker")}</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.025em]">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? t("empty") : t("total", { count: total })}
          </p>
          {manageHref ? (
            <Link
              href={manageHref}
              className="mt-2 inline-flex text-xs font-medium text-primary hover:underline"
            >
              {t("manage")}
            </Link>
          ) : null}
        </div>
        <strong className="font-heading text-4xl font-semibold tabular-nums text-primary">
          {total}
        </strong>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CATEGORIES.map((category, index) => {
          const value = values.get(category) ?? 0;
          const percentage = total > 0 ? Math.max(3, (value / total) * 100) : 0;
          return (
            <div key={category} className="min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs">
                <dt className="truncate text-muted-foreground">{categoryT(category)}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${barColours[index]}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
