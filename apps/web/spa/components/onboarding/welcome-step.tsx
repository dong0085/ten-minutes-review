import { motion, type Variants } from "motion/react";
import { useTranslations } from "use-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import { MarksStart, PenMark } from "@/spa/components/quiz/marks";

const LIST: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09, delayChildren: 0.55 } },
};

const ITEM: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
};

/** A small marked paper: it drops onto the desk and the teacher ticks it. */
function TickedPaper() {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, y: -24, rotate: -9 }}
      animate={{ opacity: 1, y: 0, rotate: -4 }}
      transition={{ type: "spring", stiffness: 190, damping: 17 }}
      className="quiz-paper-stack mx-auto w-24"
    >
      <div className="quiz-paper paper-lines relative h-28 overflow-hidden rounded-md">
        <div className="space-y-[1.15rem] px-3 pt-4">
          <div className="h-1 w-3/4 rounded-full bg-foreground/15" />
          <div className="h-1 w-1/2 rounded-full bg-foreground/15" />
          <div className="h-1 w-2/3 rounded-full bg-foreground/15" />
        </div>
        <MarksStart value={0.45}>
          <PenMark correct className="absolute right-1 bottom-1 size-11 text-destructive" />
        </MarksStart>
      </div>
    </motion.div>
  );
}

export function WelcomeStep({ onStart }: { onStart: () => void }) {
  const t = useTranslations("Onboarding.Welcome");
  const steps = [t("stepLanguage"), t("stepTour"), t("stepNotes")];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-16 text-center">
      <TickedPaper />
      <p className="eyebrow mt-10">{t("kicker")}</p>
      {/* data-reveal lets the shared highlighter sweep across once the heading settles. */}
      <motion.h1
        data-reveal="shown"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 26, delay: 0.1 }}
        className="mt-4 font-heading text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl"
      >
        {t.rich("title", {
          highlight: (chunks) => <span className="marker-swipe">{chunks}</span>,
        })}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mx-auto mt-5 max-w-md text-sm leading-7 text-muted-foreground sm:text-base"
      >
        {t("blurb")}
      </motion.p>
      <motion.ol
        variants={LIST}
        initial="hidden"
        animate="shown"
        className="mx-auto mt-9 w-full max-w-sm space-y-2.5 text-left"
      >
        {steps.map((label, index) => (
          <motion.li
            key={label}
            variants={ITEM}
            className="flex items-center gap-3.5 rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/[0.09] font-heading text-sm font-semibold text-primary">
              {index + 1}
            </span>
            {label}
          </motion.li>
        ))}
      </motion.ol>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95, type: "spring", stiffness: 260, damping: 24 }}
        className="mt-9"
      >
        <Button size="lg" onClick={onStart} className="group min-w-44">
          {t("start")}
          <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
        </Button>
      </motion.div>
    </div>
  );
}
