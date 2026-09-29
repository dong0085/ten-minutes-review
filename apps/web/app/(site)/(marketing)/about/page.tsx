import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/reveal";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Seo");
  return pageMetadata({
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    path: "/about",
  });
}

export default async function AboutPage() {
  const t = await getTranslations("About");
  const forPoints = [
    { title: t("for.noAccounts.title"), copy: t("for.noAccounts.copy") },
    { title: t("for.noSetup.title"), copy: t("for.noSetup.copy") },
    { title: t("for.noCurve.title"), copy: t("for.noCurve.copy") },
  ];

  return (
    <div className="pb-12 sm:pb-16">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
          {t("lede")}
        </p>
      </Reveal>

      <section className="border-t border-border/70 py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t("why.kicker")}</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("why.title")}
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground sm:leading-8">
            {t("why.copy")}
          </p>
        </Reveal>
      </section>

      <section className="border-t border-border/70 py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t("for.kicker")}</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("for.title")}
          </h2>
        </Reveal>
        <div className="mt-10 grid divide-y divide-border border-y border-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
          {forPoints.map(({ title, copy }, index) => (
            <Reveal
              as="article"
              key={title}
              delay={index * 120}
              className="px-2 py-7 sm:px-4 md:px-7"
            >
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-xl bg-primary/[0.08] text-primary"
              >
                <Check className="size-4.5" strokeWidth={2} />
              </span>
              <h3 className="mt-5 font-heading text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-border/70 py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t("whoBuilds.kicker")}</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("whoBuilds.title")}
          </h2>
          <p className="mt-5 font-heading text-lg italic leading-8 text-foreground/85 sm:text-xl sm:leading-9">
            {t("whoBuilds.bio")}
          </p>
          <p className="mt-5 text-base leading-7 text-muted-foreground sm:leading-8">
            {t.rich("whoBuilds.copy", {
              email: (chunks) => (
                <a
                  className="font-medium text-foreground underline underline-offset-4"
                  href="mailto:contact@ericinottawa.ca"
                >
                  {chunks}
                </a>
              ),
              portfolio: (chunks) => (
                <a
                  className="font-medium text-foreground underline underline-offset-4"
                  href="https://ericinottawa.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </Reveal>
      </section>
    </div>
  );
}
