import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResetForm } from "@/components/auth/reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("ResetPage.title"),
    robots: { index: false },
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = first(params.token) ?? "";
  const t = await getTranslations("Auth.ResetPage");

  return (
    <div className="mx-auto max-w-md space-y-7 py-6 sm:py-10">
      <div className="text-center">
        <div className="mx-auto h-px w-10 bg-primary/40" />
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
      </div>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            {t("invalid")}{" "}
            <Link className="font-medium underline" href="/forgot">
              {t("requestNew")}
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
