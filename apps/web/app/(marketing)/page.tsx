import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  Check,
  Clock3,
  Feather,
  FileText,
  NotebookPen,
  Pause,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { QuizFormCards } from "@/components/quiz-form-cards";
import { env } from "@/lib/env";
import { languageLabel } from "@/lib/language-label";
import { getCurrentUserOrGuest } from "@/lib/session";

/* A hello in each language learners bring notes in, shown under the hero. */
const GREETINGS = [
  { code: "fr", hello: "Bonjour" },
  { code: "es", hello: "Hola" },
  { code: "zh", hello: "你好" },
  { code: "ja", hello: "こんにちは" },
  { code: "ko", hello: "안녕하세요" },
  { code: "pt", hello: "Olá" },
  { code: "ru", hello: "Привет" },
  { code: "hi", hello: "नमस्ते" },
  { code: "vi", hello: "Xin chào" },
  { code: "en", hello: "Hello" },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Seo");
  return {
    title: { absolute: t("homeTitle") },
    description: t("homeDescription"),
    alternates: { canonical: "/" },
    openGraph: {
      title: t("homeTitle"),
      description: t("homeDescription"),
      url: "/",
      type: "website",
    },
  };
}

export default async function HomePage() {
  const current = await getCurrentUserOrGuest();
  const user = current?.user ?? null;
  const t = await getTranslations("Home");
  const seo = await getTranslations("Seo");
  const locale = await getLocale();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Ten Minutes Review",
    description: seo("homeDescription"),
    url: env.appUrl,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
  };
  const steps = [
    { icon: FileText, number: "01", title: t("steps.addTitle"), copy: t("steps.addCopy") },
    { icon: Sparkles, number: "02", title: t("steps.shapeTitle"), copy: t("steps.shapeCopy") },
    { icon: Clock3, number: "03", title: t("steps.reviewTitle"), copy: t("steps.reviewCopy") },
  ];
  const highlights = [
    {
      icon: Feather,
      title: t("highlights.noPressure.title"),
      copy: t("highlights.noPressure.copy"),
    },
    {
      icon: Pause,
      title: t("highlights.pause.title"),
      copy: t("highlights.pause.copy"),
    },
    {
      icon: NotebookPen,
      title: t("highlights.notes.title"),
      copy: t("highlights.notes.copy"),
    },
  ];

  return (
    <div className="pb-12 sm:pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="section-band band-dots relative grid min-h-[34rem] items-center gap-12 py-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-14">
        <Reveal className="relative z-10 max-w-2xl">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-5 max-w-3xl font-heading text-5xl leading-[0.98] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.6rem]">
            {t.rich("title", {
              highlight: (chunks) => <span className="marker-swipe">{chunks}</span>,
            })}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Button asChild size="lg">
                <Link href="/classrooms">
                  {t("goToClassrooms")}
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/classrooms/new">
                    {t("tryAsGuest")}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/signup">{t("createAccount")}</Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href="/signin">{t("signIn")}</Link>
                </Button>
              </>
            )}
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            {[t("proof.handwriting"), t("proof.fresh"), t("proof.tenMinutes")].map(
              (item, index) => (
                <li
                  key={item}
                  className={`flex items-center gap-1.5 ${
                    index === 1 ? "-rotate-1 rounded-full bg-primary/[0.07] px-2.5 py-1" : ""
                  }`}
                >
                  <Check className="size-3.5 text-primary" strokeWidth={2} />
                  {item}
                </li>
              ),
            )}
          </ul>
        </Reveal>

        <Reveal delay={150} className="relative mx-auto w-full max-w-[34rem] lg:mx-0">
          <div
            aria-hidden="true"
            className="absolute -inset-8 -z-10 rounded-full bg-primary/[0.07] blur-3xl"
          />
          <div className="editorial-surface paper-lines relative overflow-hidden rounded-[2rem] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <p className="eyebrow">{t("preview.kicker")}</p>
                <p className="mt-1 font-heading text-xl font-semibold">
                  <span className="marker-note">{t("preview.title")}</span>
                </p>
              </div>
              <span className="grid size-9 place-items-center rounded-full border border-primary/15 bg-primary/[0.08] text-primary">
                <Camera className="size-4" />
              </span>
            </div>

            <div className="relative ml-1 max-w-[88%] -rotate-[1.4deg] rounded-xl border border-border bg-card px-4 py-4 shadow-[0_10px_32px_rgb(var(--shadow-colour)/0.08)] sm:px-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold">{t("preview.notes")}</span>
                <span className="text-[0.65rem] text-muted-foreground">{t("preview.session")}</span>
              </div>
              <div className="mt-3 space-y-2 font-heading text-[0.96rem] italic text-foreground/82">
                <p>prendre soin de — to take care of</p>
                <p>la confiance — confidence</p>
                <p>il faut + infinitif</p>
              </div>
            </div>

            <div className="relative -mt-1 ml-auto max-w-[90%] rotate-[1.2deg] rounded-2xl border border-primary/20 bg-card p-4 shadow-[0_14px_38px_rgb(var(--shadow-colour)/0.1)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-primary uppercase">
                    {t("preview.quiz")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("preview.question")}</p>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-[0.65rem] font-semibold text-success">
                  {t("preview.ready")}
                </span>
              </div>
              <p className="mt-4 font-heading text-xl font-semibold tracking-[-0.01em]">
                Il faut ___ de soi.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5 text-sm">
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.65rem] text-primary-foreground">
                  A
                </span>
                prendre soin
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="section-band band-airmail py-12 sm:py-14">
        <Reveal className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow">{t("languagesKicker")}</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {t("languagesCopy")}
            </p>
          </div>
          <ul className="flex flex-wrap gap-2.5">
            {GREETINGS.map(({ code, hello }, index) => (
              <li
                key={code}
                lang={code}
                className={`flex items-baseline gap-2 rounded-full border border-border/80 bg-card/70 px-3.5 py-1.5 ${
                  index % 3 === 1 ? "-rotate-1" : index % 3 === 2 ? "rotate-1" : ""
                }`}
              >
                <span className="font-heading text-base font-semibold">{hello}</span>
                <span className="text-[0.7rem] text-muted-foreground">
                  {languageLabel(code, locale)}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section id="how-it-works" className="section-band band-graph py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t("howItWorksKicker")}</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("howItWorksTitle")}
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 md:grid-cols-3">
          {steps.map(({ icon: Icon, number, title, copy }, index) => (
            <Reveal
              as="article"
              key={number}
              delay={index * 120}
              className="group bg-card/95 p-6 sm:p-7"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/[0.08] text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
                  <Icon className="size-4.5" />
                </span>
                <span className="font-heading text-sm italic text-muted-foreground/65">{number}</span>
              </div>
              <h3 className="mt-7 font-heading text-xl font-semibold">
                {index === 1 ? <span className="marker-note">{title}</span> : title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section-band band-desk grid gap-8 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
        <Reveal>
          <BookOpenCheck className="size-5 text-primary" />
          <h2 className="mt-5 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t.rich("categoriesTitle", {
              highlight: (chunks) => <span className="marker-loop">{chunks}</span>,
            })}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {t("categoriesCopy")}
          </p>
        </Reveal>
        <QuizFormCards />
      </section>

      <section className="section-band band-ruled py-16 sm:py-20">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">{t("highlights.kicker")}</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("highlights.title")}
          </h2>
        </Reveal>
        <div className="mt-10 grid divide-y divide-border border-y border-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
          {highlights.map(({ icon: Icon, title, copy }, index) => (
            <Reveal
              as="article"
              key={title}
              delay={index * 120}
              className="group px-2 py-7 sm:px-4 md:px-7 md:py-8"
            >
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-xl bg-primary/[0.08] text-primary transition-transform duration-200 group-hover:-translate-y-0.5"
              >
                <Icon className="size-4.5" />
              </span>
              <h3 className="mt-5 font-heading text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal
        as="section"
        className="relative isolate overflow-hidden rounded-[2rem] border border-primary/15 bg-primary/[0.075] px-6 py-12 text-center sm:px-10 sm:py-16"
      >
        <div aria-hidden="true" className="cta-rays absolute inset-0 -z-10" />
        <div aria-hidden="true" className="absolute inset-x-16 top-0 h-px bg-primary/25" />
        <p className="eyebrow">{t("closingKicker")}</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          {t.rich("closingTitle", {
            highlight: (chunks) => <span className="marker-swipe marker-swipe-alt">{chunks}</span>,
          })}
        </h2>
        <Button asChild size="lg" className="mt-7">
          <Link href={user ? "/classrooms" : "/signup"}>
            {user ? t("goToClassrooms") : t("createAccount")}
            <ArrowRight />
          </Link>
        </Button>
      </Reveal>
    </div>
  );
}
