import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotForm } from "@/components/auth/forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("ForgotPage.title"),
    robots: { index: false },
  };
}

export default async function ForgotPage() {
  const t = await getTranslations("Auth.ForgotPage");
  return (
    <div className="mx-auto max-w-md space-y-7 py-6 sm:py-10">
      <div className="text-center">
        <div className="mx-auto h-px w-10 bg-primary/40" />
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ForgotForm />
    </div>
  );
}
