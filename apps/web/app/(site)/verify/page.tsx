import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VerifyView } from "@/components/auth/verify-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return {
    title: t("VerifyPage.title"),
    robots: { index: false },
  };
}

export default async function VerifyPage() {
  const t = await getTranslations("Auth.VerifyPage");
  return (
    <div className="mx-auto max-w-md space-y-7 py-6 sm:py-10">
      <div className="text-center">
        <div className="mx-auto h-px w-10 bg-primary/40" />
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
      </div>
      <VerifyView />
    </div>
  );
}
