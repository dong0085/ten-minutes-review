import { useDeferredValue, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { ChevronRight, EyeOff, Loader2, RotateCcw, Search } from "lucide-react";
import { CATEGORIES, type Category } from "@tmr/core";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Input } from "@tmr/ui/components/input";
import { cn } from "@tmr/ui/utils";
import { useToggleOmit } from "@/lib/bank-actions";
import type { BankItem } from "@/lib/queries";

type StatusFilter = "active" | "omitted" | "all";

const PAGE_SIZE = 60;

function matches(item: BankItem, query: string) {
  if (query === "") {
    return true;
  }
  return [item.targetText, item.nativeText, item.note].some((value) =>
    value?.toLocaleLowerCase().includes(query),
  );
}

function isCategory(value: string): value is Category {
  return CATEGORIES.some((category) => category === value);
}

function readStatus(value: string | null): StatusFilter {
  return value === "omitted" || value === "all" ? value : "active";
}

/**
 * Search and filter the bank. Filters live in the address, so stepping into a
 * point and back returns to the same list.
 */
export function BankManager({ classroomId, items }: { classroomId: string; items: BankItem[] }) {
  const t = useTranslations("Classroom.BankPage");
  const categoryT = useTranslations("Category");
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const categoryParam = params.get("category");
  const category: Category | "all" =
    categoryParam && isCategory(categoryParam) ? categoryParam : "all";
  const status = readStatus(params.get("status"));
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const toggleOmit = useToggleOmit(classroomId);

  function update(next: Record<string, string | null>) {
    setLimit(PAGE_SIZE);
    setParams(
      (current) => {
        const merged = new URLSearchParams(current);
        for (const [key, value] of Object.entries(next)) {
          if (value === null || value === "") {
            merged.delete(key);
          } else {
            merged.set(key, value);
          }
        }
        return merged;
      },
      { replace: true },
    );
  }

  const activeCount = items.filter((item) => !item.isRetired).length;
  const omittedCount = items.length - activeCount;

  const statusMatches = useMemo(
    () =>
      items.filter((item) =>
        status === "all" ? true : status === "omitted" ? item.isRetired : !item.isRetired,
      ),
    [items, status],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const item of statusMatches) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [statusMatches]);
  const visible = useMemo(
    () =>
      statusMatches.filter(
        (item) => (category === "all" || item.category === category) && matches(item, deferredQuery),
      ),
    [statusMatches, category, deferredQuery],
  );

  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: "active", label: t("statusActive"), count: activeCount },
    { value: "omitted", label: t("statusOmitted"), count: omittedCount },
    { value: "all", label: t("statusAll"), count: items.length },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => update({ q: event.target.value })}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="pl-9"
            />
          </div>
          <div
            role="radiogroup"
            aria-label={t("statusLabel")}
            className="flex shrink-0 gap-1 rounded-xl border border-border/70 bg-muted/45 p-1"
          >
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={status === option.value}
                onClick={() => update({ status: option.value === "active" ? null : option.value })}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition sm:flex-none",
                  status === option.value
                    ? "bg-card text-foreground shadow-[0_1px_3px_rgb(var(--shadow-colour)/0.08)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
                <span className="tabular-nums text-muted-foreground">{option.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div role="radiogroup" aria-label={t("categoryLabel")} className="flex flex-wrap gap-1.5">
          {(["all", ...CATEGORIES] as const).map((value) => {
            const selected = category === value;
            const count = value === "all" ? statusMatches.length : (categoryCounts.get(value) ?? 0);
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ category: value === "all" ? null : value })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                  selected
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "all" ? t("allCategories") : categoryT(value)}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noMatches")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => update({ q: null, category: null, status: "all" })}
          >
            {t("clearFilters")}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/75">
          {visible.slice(0, limit).map((item) => {
            const pending = toggleOmit.isPending && toggleOmit.variables?.id === item.id;
            return (
              <li key={item.id} className={cn("flex items-center", item.isRetired && "bg-muted/30")}>
                <Link
                  to={`/classrooms/${classroomId}/bank/${item.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/[0.04] sm:px-5"
                >
                  <span className={cn("min-w-0 flex-1", item.isRetired && "opacity-60")}>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-[0.95rem] font-medium">{item.targetText}</span>
                      {item.nativeText ? (
                        <span className="truncate text-sm text-muted-foreground">
                          {item.nativeText}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{categoryT(item.category)}</Badge>
                      {item.isRetired ? <Badge variant="outline">{t("omittedBadge")}</Badge> : null}
                      {item.inferred ? (
                        <Badge variant="warning" title={t("inferredHint")}>
                          {t("inferredBadge")}
                        </Badge>
                      ) : null}
                      <span className="text-[0.72rem] text-muted-foreground tabular-nums">
                        {item.answered > 0
                          ? t("stats", { answered: item.answered, missed: item.missed })
                          : t("notAsked")}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="mr-3 shrink-0 sm:mr-4"
                  disabled={pending}
                  onClick={() => toggleOmit.mutate({ id: item.id, omit: !item.isRetired })}
                  title={item.isRetired ? t("restoreHint") : t("omitHint")}
                  aria-label={item.isRetired ? t("restore") : t("omit")}
                >
                  {pending ? (
                    <Loader2 className="animate-spin" />
                  ) : item.isRetired ? (
                    <RotateCcw />
                  ) : (
                    <EyeOff />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > limit ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            {t("showMore", { count: Math.min(PAGE_SIZE, visible.length - limit) })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
