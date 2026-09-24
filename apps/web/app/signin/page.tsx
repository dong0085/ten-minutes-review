import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignInForm } from "@/components/auth/signin-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("SignInPage.title"),
    robots: { index: false },
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const verified = first(params.verified) === "1";
  const error = first(params.error);
  const t = await getTranslations("Auth.SignInPage");

  return (
    <div className="mx-auto max-w-md space-y-7 py-6 sm:py-10">
      <div className="text-center">
        <div className="mx-auto h-px w-10 bg-primary/40" />
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
      </div>
      {verified ? (
        <Alert variant="success">
          <AlertDescription>{t("verified")}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t("signInError")}</AlertDescription>
        </Alert>
      ) : null}
      <SignInForm />
    </div>
  );
}
