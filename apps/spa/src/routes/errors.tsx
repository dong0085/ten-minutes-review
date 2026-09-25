import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@tmr/ui/components/button";
import { isNotFound } from "@/lib/api";
import { NotFoundPage } from "./not-found";

export function RouteError() {
  const error = useRouteError();
  if (isNotFound(error) || (isRouteErrorResponse(error) && error.status === 404)) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <NotFoundPage />
      </main>
    );
  }
  return <ErrorPanel />;
}

export function ErrorPanel({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations("App.Shell");
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">{t("errorTitle")}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("errorBlurb")}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={onRetry ?? (() => window.location.reload())}>{t("retry")}</Button>
        <Button asChild variant="outline">
          <Link to="/classrooms">{t("toClassrooms")}</Link>
        </Button>
      </div>
    </div>
  );
}
