import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useLocale, useTranslations } from "use-intl";
import { ArrowRight } from "lucide-react";
import { DEMO_PAPERS, LANGUAGES, type LanguageCode } from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import { cn } from "@tmr/ui/utils";
import { languageLabel } from "@/spa/lib/language-label";

const GRID: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.035, delayChildren: 0.1 } },
};

const CARD: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 340, damping: 26 },
  },
};

function LanguageCard({
  code,
  label,
  selected,
  dimmed,
  committed,
  onSelect,
}: {
  code: LanguageCode;
  label: string;
  selected: boolean;
  dimmed: boolean;
  committed: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [first, second] = DEMO_PAPERS[code].greetings;
  const greeting = hovered ? second : first;

  return (
    <motion.button
      type="button"
      variants={CARD}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      onClick={onSelect}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className={cn(
        "relative flex h-28 flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left outline-none transition-[border-color,background-color,box-shadow] duration-200 focus-visible:ring-3 focus-visible:ring-ring/40 [&>*]:transition-opacity [&>*]:duration-200",
        selected
          ? "border-primary bg-primary/[0.06] shadow-[0_10px_30px_-12px_color-mix(in_oklch,var(--primary),transparent_45%)]"
          : "border-border/75 bg-card/75 hover:border-primary/35 hover:bg-card",
        dimmed && "[&>*]:opacity-45",
      )}
    >
      <span className="relative block h-8 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={greeting}
            lang={code}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="block truncate font-heading text-2xl leading-8 font-semibold tracking-[-0.02em]"
          >
            {greeting}
          </motion.span>
        </AnimatePresence>
      </span>
      {/* Once confirmed, this label flies up into the header as the language chip. */}
      <motion.span
        layoutId={selected && !committed ? `language-${code}` : undefined}
        className="w-fit text-sm text-muted-foreground"
      >
        {label}
      </motion.span>
      {selected ? (
        <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden="true">
            <motion.path
              d="M5 12.5 10 17.5 19 7"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, ease: [0.3, 0, 0.2, 1] }}
            />
          </svg>
        </span>
      ) : null}
    </motion.button>
  );
}

export function LanguageStep({
  targetLanguage,
  nativeLanguage,
  committed,
  onTargetChange,
  onNativeChange,
  onContinue,
}: {
  targetLanguage: LanguageCode | null;
  nativeLanguage: string;
  committed: boolean;
  onTargetChange: (code: LanguageCode) => void;
  onNativeChange: (code: string) => void;
  onContinue: () => void;
}) {
  const t = useTranslations("Onboarding.Language");
  const locale = useLocale();

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <div className="text-center">
        <p className="eyebrow">{t("kicker")}</p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("blurb")}</p>
      </div>

      <motion.div
        variants={GRID}
        initial="hidden"
        animate="shown"
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
      >
        {LANGUAGES.map(({ code }) => (
          <LanguageCard
            key={code}
            code={code}
            label={languageLabel(code, locale)}
            selected={targetLanguage === code}
            dimmed={targetLanguage !== null && targetLanguage !== code}
            committed={committed}
            onSelect={() => onTargetChange(code)}
          />
        ))}
      </motion.div>

      {/* On a phone the grid runs off-screen, so the actions stay pinned to the bottom. */}
      <div className="sticky bottom-3 z-10 mt-8 flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/85 p-3 backdrop-blur-xl sm:static sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
          {t("speak")}
          <select
            value={nativeLanguage}
            onChange={(event) => onNativeChange(event.target.value)}
            className="h-9 max-w-36 rounded-xl border border-input/90 bg-card/55 px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25 dark:bg-input/20"
          >
            {LANGUAGES.map(({ code }) => (
              <option key={code} value={code}>
                {languageLabel(code, locale)}
              </option>
            ))}
          </select>
        </label>
        <AnimatePresence>
          {targetLanguage ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <Button size="lg" onClick={onContinue} className="group sm:min-w-40">
                {t("continue")}
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
