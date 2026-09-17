import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Seo");
  return {
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    alternates: { canonical: "/privacy" },
    openGraph: {
      title: t("privacyTitle"),
      description: t("privacyDescription"),
      url: "/privacy",
      type: "website",
    },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");
  const stored = [
    t("store.email"),
    t("store.quizzes"),
    t("store.names"),
    t("store.files"),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-12 py-6 sm:py-10">
      <header>
        <h1 className="font-heading text-4xl font-semibold tracking-[-0.035em]">
          {t("title")}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("lede")}</p>
      </header>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">{t("store.title")}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{t("store.lede")}</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
          {stored.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">{t("use.title")}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{t("use.copy")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">{t("analytics.title")}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{t("analytics.copy")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">{t("email.title")}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{t("email.copy")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">{t("deletion.title")}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {t.rich("deletion.copy", {
            email: (chunks) => (
              <a
                className="font-medium text-foreground underline underline-offset-4"
                href="mailto:contact@ericinottawa.ca"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>
    </div>
  );
}
