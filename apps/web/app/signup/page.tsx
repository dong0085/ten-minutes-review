import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignUpForm } from "@/components/auth/signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("SignUpForm.createAccount"),
    robots: { index: false },
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = first(params.code) ?? "";
  const error = first(params.error);
  const t = await getTranslations("Auth.SignUpPage");

  return (
    <div className="mx-auto max-w-md space-y-7 py-6 sm:py-10">
      <div className="text-center">
        <div className="mx-auto h-px w-10 bg-primary/40" />
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
      </div>
      {error === "invite" ? (
        <Alert variant="destructive">
          <AlertDescription>{t("inviteError")}</AlertDescription>
        </Alert>
      ) : null}
      <SignUpForm initialCode={code} />
    </div>
  );
}
