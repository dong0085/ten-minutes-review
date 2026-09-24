"use client";

import type { Category } from "@tmr/core";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* The question-form cluster on the homepage: one sample quiz card per
   question form, lying on the page with a slight editorial tilt. When the
   cluster scrolls into view each card is dealt in — it starts face-down
   above its spot and flips over onto it, staggered like a hand of cards.
   The observer mirrors components/reveal.tsx; the motion is CSS. */

type FormKey = "mcq" | "fillBlank" | "trueFalse" | "photo";

const CARDS: { form: FormKey; category: Category; tilt: string }[] = [
  { form: "mcq", category: "vocabulary", tilt: "-rotate-[3.5deg]" },
  { form: "fillBlank", category: "grammar", tilt: "rotate-[2.5deg]" },
  { form: "trueFalse", category: "comprehension", tilt: "rotate-[3.5deg]" },
  { form: "photo", category: "phrase", tilt: "-rotate-[2.5deg]" },
];

export function QuizFormCards() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dealt, setDealt] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDealt(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-dealt={dealt ? "true" : "false"} className="grid gap-6 sm:grid-cols-2">
      {CARDS.map((card, index) => (
        <div key={card.form} className={cn(card.tilt, index % 2 === 1 && "lg:mt-12")}>
          <div className="[perspective:1200px]">
            <div className="deal-inner" style={{ transitionDelay: `${index * 130}ms` }}>
              <SampleCardView card={card} index={index} />
              <div
                aria-hidden="true"
                className="deal-face deal-back absolute inset-0 grid place-items-center rounded-2xl border border-border bg-card paper-lines shadow-[0_14px_38px_rgb(var(--shadow-colour)/0.08)]"
              >
                <span className="grid size-12 place-items-center rounded-[0.85rem] border border-primary/20 bg-primary/[0.08] font-heading text-lg font-semibold tracking-[-0.06em] text-primary -rotate-2">
                  10′
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SampleCardView({ card, index }: { card: { form: FormKey; category: Category }; index: number }) {
  const t = useTranslations("Home.forms");
  const categoryT = useTranslations("Category");

  return (
    <article className="deal-face relative rounded-2xl border border-border bg-card p-4 shadow-[0_14px_38px_rgb(var(--shadow-colour)/0.08)] sm:p-5">
      <header className="flex items-center justify-between gap-3">
        <Badge variant="secondary">{categoryT(card.category)}</Badge>
        <span className="font-heading text-sm italic text-muted-foreground/60">
          {String(index + 1).padStart(2, "0")}
        </span>
      </header>
      <p className="mt-4 text-[0.65rem] font-semibold tracking-[0.16em] text-primary uppercase">
        {t(card.form)}
      </p>

      {card.form === "mcq" ? (
        <>
          <Stem>{t("stems.mcq")}</Stem>
          <OptionList
            options={[
              { label: "la confiance", selected: true },
              { label: "la sortie" },
              { label: "le moyen" },
            ]}
          />
        </>
      ) : null}

      {card.form === "fillBlank" ? (
        <>
          <Stem>Il faut ___ soin de soi.</Stem>
          <div className="mt-4">
            <span className="text-[0.68rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {t("blankLabel")}
            </span>
            <div className="mt-1.5 flex h-9 items-center rounded-lg border border-input bg-card px-3 font-heading text-sm italic">
              prendre
            </div>
          </div>
        </>
      ) : null}

      {card.form === "trueFalse" ? (
        <>
          <Stem>{t("stems.trueFalse")}</Stem>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-medium">
            <span className="flex h-10 items-center justify-center rounded-lg border border-primary bg-primary text-primary-foreground">
              {t("true")}
            </span>
            <span className="flex h-10 items-center justify-center rounded-lg border border-border bg-card">
              {t("false")}
            </span>
          </div>
        </>
      ) : null}

      {card.form === "photo" ? (
        <>
          <Stem>{t("stems.photo")}</Stem>
          <div className="mt-3 -rotate-1 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3 font-heading text-sm leading-7 italic text-foreground/85 paper-lines">
            <p>il faut + infinitif</p>
            <p>
              <span className="relative inline-block">
                prendre soin de
                <svg
                  aria-hidden="true"
                  viewBox="0 0 120 36"
                  preserveAspectRatio="none"
                  className="absolute -inset-x-2 -inset-y-1.5 h-[calc(100%+0.75rem)] w-[calc(100%+1rem)] -rotate-1 text-primary"
                >
                  <ellipse
                    cx="60"
                    cy="18"
                    rx="57"
                    ry="14.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
            </p>
            <p>la confiance</p>
          </div>
          <OptionList
            options={[
              { label: "prendre soin de", selected: true },
              { label: "avoir envie de" },
              { label: "rendre visite à" },
            ]}
          />
        </>
      ) : null}
    </article>
  );
}

function Stem({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 font-heading text-lg leading-snug font-semibold tracking-[-0.01em]">
      {children}
    </p>
  );
}

function OptionList({ options }: { options: { label: string; selected?: boolean }[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {options.map((option, index) => (
        <li
          key={option.label}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
            option.selected ? "border-primary/45 bg-primary/[0.07]" : "border-border/80 bg-card/45",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-lg border text-[0.65rem] font-semibold",
              option.selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/50 text-muted-foreground",
            )}
          >
            {String.fromCharCode(65 + index)}
          </span>
          {option.label}
        </li>
      ))}
    </ul>
  );
}
