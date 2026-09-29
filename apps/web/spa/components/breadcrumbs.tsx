import type { ReactNode } from "react";
import { Link, useMatches, type Params } from "react-router";
import { useTranslations } from "use-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CrumbHandle = { crumb: (params: Params) => ReactNode };

function hasCrumb(handle: unknown): handle is CrumbHandle {
  return typeof handle === "object" && handle !== null && "crumb" in handle;
}

/**
 * The trail of places above the current screen. Wide screens show every step;
 * phones show a back arrow to the parent and the current title.
 */
export function Breadcrumbs() {
  const t = useTranslations("App.Shell");
  const trail = useMatches()
    .filter((match) => hasCrumb(match.handle))
    .map((match) => ({
      href: match.pathname,
      label: (match.handle as CrumbHandle).crumb(match.params),
    }));
  if (trail.length === 0) {
    return null;
  }
  const current = trail[trail.length - 1];
  const parent = trail.length > 1 ? trail[trail.length - 2] : null;

  return (
    <nav aria-label={t("breadcrumb")} className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1 sm:hidden">
        {parent ? (
          <Link
            to={parent.href}
            aria-label={t("back")}
            className="-ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : null}
        <span className="truncate text-sm font-medium">{current?.label}</span>
      </div>
      <ol className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
        {trail.map((step, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={step.href} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/60" />
              ) : null}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {step.label}
                </span>
              ) : (
                <Link
                  to={step.href}
                  className="truncate text-muted-foreground transition hover:text-foreground"
                >
                  {step.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
