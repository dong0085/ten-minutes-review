"use client";

import type { Category } from "@tmr/core";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* The question-form showcase on the homepage: sample quiz cards, one per
   question form, start scattered and are dealt onto a single pile as the
   visitor scrolls. The outer section is tall; the inner stage pins to the
   viewport and scroll position drives each card's pose, so the page appears
   to hold still while the deck shuffles. Visitors who prefer reduced motion
   (and anyone without JavaScript) get the same cards as a plain grid. */

type FormKey = "mcq" | "fillBlank" | "trueFalse" | "photo";

type SampleCard = {
  form: FormKey;
  category: Category;
  /** Scatter pose: x/y as fractions of half the stage, then degrees. */
  scatter: readonly [number, number, number];
  /** Pile pose: x/y in pixels, then degrees. */
  pile: readonly [number, number, number];
};

const CARDS: readonly SampleCard[] = [
  { form: "mcq", category: "vocabulary", scatter: [-0.62, -0.36, -8], pile: [-9, -5, -4.5] },
  { form: "fillBlank", category: "grammar", scatter: [0.64, -0.32, 7], pile: [-3, -2, -1.5] },
  { form: "trueFalse", category: "comprehension", scatter: [-0.58, 0.4, 9], pile: [3, 2, 1.8] },
  { form: "photo", category: "phrase", scatter: [0.6, 0.36, -7], pile: [9, 5, 5] },
];

/** Viewport-heights of scroll the whole shuffle plays out over. */
const STAGE_SPANS = 3.6;
const INTRO = 0.05;
const OUTRO = 0.95;
const SEGMENT = (OUTRO - INTRO) / CARDS.length;
/** Fraction of a card's segment spent flying to centre, and where it starts
   settling onto the pile. Between the two it holds still and readable. */
const FOCUS_AT = 0.42;
const LAND_AT = 0.78;

type Pose = { x: number; y: number; rotate: number; scale: number; lift: number };

const SCATTER_SCALE = 0.84;
const PILE_SCALE = 0.94;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// A gentle overshoot so the card lands on the pile with a springy settle.
const easeOutBack = (t: number) => {
  const c1 = 1.4;
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    rotate: a.rotate + (b.rotate - a.rotate) * t,
    scale: a.scale + (b.scale - a.scale) * t,
    lift: a.lift + (b.lift - a.lift) * t,
  };
}

/** Pose for one card at `t`, its progress through its own deal: negative
 * before its turn, 0–1 while flying in / holding / landing, past 1 on pile. */
function cardPose(card: SampleCard, t: number, width: number, height: number, spread: number): Pose {
  const scatter: Pose = {
    x: card.scatter[0] * (width / 2) * spread,
    y: card.scatter[1] * (height / 2) * spread,
    rotate: card.scatter[2],
    scale: SCATTER_SCALE,
    lift: 0,
  };
  const focus: Pose = { x: 0, y: 0, rotate: 0, scale: 1, lift: 1 };
  const pile: Pose = { x: card.pile[0], y: card.pile[1], rotate: card.pile[2], scale: PILE_SCALE, lift: 0.3 };

  if (t <= 0) {
    return scatter;
  }
  if (t < FOCUS_AT) {
    return mixPose(scatter, focus, easeOutCubic(t / FOCUS_AT));
  }
  if (t < LAND_AT) {
    return focus;
  }
  if (t < 1) {
    const u = (t - LAND_AT) / (1 - LAND_AT);
    const pose = mixPose(focus, pile, easeInOutCubic(u));
    return { ...pose, rotate: focus.rotate + (pile.rotate - focus.rotate) * easeOutBack(u) };
  }
  return pile;
}

/** True when the visitor prefers reduced motion. The server snapshot stays
 * true so markup renders as the static grid and upgrades to the stage after
 * hydration — no-JS visitors keep the grid. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

export function QuizFormShuffle() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const t = useTranslations("Home.forms");
  const enabled = !usePrefersReducedMotion();

  const captions = [
    { name: t("mcq.name"), hint: t("mcq.hint") },
    { name: t("fillBlank.name"), hint: t("fillBlank.hint") },
    { name: t("trueFalse.name"), hint: t("trueFalse.hint") },
    { name: t("photo.name"), hint: t("photo.hint") },
    { name: t("outro.name"), hint: t("outro.hint") },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    if (!enabled || !section) {
      return;
    }

    const update = () => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const rect = section.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const progress = span <= 0 ? 1 : clamp01(-rect.top / span);
      // Scatter offsets are tuned for wide stages; cluster on narrow ones.
      const spread = Math.min(1, Math.max(0.5, stage.clientWidth / 960));

      CARDS.forEach((card, index) => {
        const element = cardRefs.current[index];
        if (!element) {
          return;
        }
        const t = (progress - (INTRO + index * SEGMENT)) / SEGMENT;
        const pose = cardPose(card, t, stage.clientWidth, stage.clientHeight, spread);
        element.style.transform = `translate(-50%, -50%) translate3d(${pose.x.toFixed(2)}px, ${pose.y.toFixed(2)}px, 0) rotate(${pose.rotate.toFixed(2)}deg) scale(${pose.scale.toFixed(3)})`;
        element.style.zIndex = t > 0 && t < 1 ? "30" : String(index + 1);
        element.style.boxShadow = `0 ${(8 + 16 * pose.lift).toFixed(1)}px ${(24 + 36 * pose.lift).toFixed(1)}px rgb(var(--shadow-colour)/${(0.06 + 0.06 * pose.lift).toFixed(3)})`;
      });

      const next =
        progress >= OUTRO
          ? CARDS.length
          : Math.min(CARDS.length - 1, Math.max(0, Math.floor((progress - INTRO) / SEGMENT)));
      setActive((prev) => (prev === next ? prev : next));
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    if (stageRef.current) {
      observer.observe(stageRef.current);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [enabled]);

  if (!enabled) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-5 pb-4 sm:grid-cols-2">
        {CARDS.map((card, index) => (
          <SampleCardView
            key={card.form}
            card={card}
            index={index}
            className={index % 2 === 0 ? "-rotate-1" : "rotate-1"}
          />
        ))}
      </div>
    );
  }

  return (
    <section ref={sectionRef} style={{ height: `${STAGE_SPANS * 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden">
        <div ref={stageRef} className="relative flex-1 select-none">
          {CARDS.map((card, index) => (
            <div
              key={card.form}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
              className="absolute top-1/2 left-1/2 w-[min(19.5rem,84vw)] will-change-transform"
            >
              <SampleCardView card={card} index={index} />
            </div>
          ))}
        </div>
        <footer className="relative z-40 mx-auto w-full max-w-5xl pb-6 sm:pb-10">
          <div className="flex items-end justify-between gap-6">
            <div aria-live="polite" className="relative min-h-[3.4rem] flex-1">
              {captions.map((caption, index) => (
                <div key={caption.name} className="shuffle-caption" data-active={index === active}>
                  <p className="eyebrow">
                    {String(index + 1).padStart(2, "0")} · {caption.name}
                  </p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{caption.hint}</p>
                </div>
              ))}
            </div>
            <ol aria-hidden="true" className="mb-0.5 flex shrink-0 list-none gap-2">
              {captions.map((caption, index) => (
                <li key={caption.name} className="shuffle-dot" data-active={index === active} />
              ))}
            </ol>
          </div>
        </footer>
      </div>
    </section>
  );
}

function SampleCardView({
  card,
  index,
  className,
}: {
  card: SampleCard;
  index: number;
  className?: string;
}) {
  const t = useTranslations("Home.forms");
  const categoryT = useTranslations("Category");

  return (
    <article className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <header className="flex items-center justify-between gap-3">
        <Badge variant="secondary">{categoryT(card.category)}</Badge>
        <span className="font-heading text-sm italic text-muted-foreground/60">
          {String(index + 1).padStart(2, "0")}
        </span>
      </header>

      {card.form === "mcq" ? (
        <>
          <Stem>Which word means «&nbsp;confidence&nbsp;»?</Stem>
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
          <Stem>In the passage, Marie takes the train before lunch.</Stem>
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
          <Stem>Which expression did the tutor circle?</Stem>
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
    <p className="mt-4 font-heading text-lg leading-snug font-semibold tracking-[-0.01em]">
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
