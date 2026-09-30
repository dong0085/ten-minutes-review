import { useState } from "react";
import { Navigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Variants,
} from "motion/react";
import { useLocale, useTranslations } from "use-intl";
import { isLanguageCode, type LanguageCode } from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import { FullPageSpinner } from "@/spa/app/shell";
import { BrandMark } from "@/spa/components/brand-mark";
import { LanguageStep } from "@/spa/components/onboarding/language-step";
import { NotesStep } from "@/spa/components/onboarding/notes-step";
import { PaperTour } from "@/spa/components/onboarding/paper-tour";
import { StepRail } from "@/spa/components/onboarding/step-rail";
import { WelcomeStep } from "@/spa/components/onboarding/welcome-step";
import { languageLabel } from "@/spa/lib/language-label";
import { markOnboarded, needsOnboarding } from "@/spa/lib/onboarding";
import { useClassrooms } from "@/spa/lib/queries";
import { useRouter } from "@/spa/lib/router";
import { useSession } from "@/spa/lib/session";

const STEPS = ["welcome", "language", "tour", "notes"] as const;
type Step = (typeof STEPS)[number];

// Screens slide in from the side they come from, so Back feels like turning back a page.
const SCREEN: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
  shown: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 260, damping: 30 },
  },
  leave: (direction: number) => ({
    opacity: 0,
    x: direction * -28,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  }),
};

export function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const signedIn = Boolean(session && !session.isGuest);
  const { data: classroomList, isPending } = useClassrooms(Boolean(session));
  const [step, setStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState(1);
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode | null>(
    null,
  );
  const [nativeLanguage, setNativeLanguage] = useState<string>(() => {
    const preferred = session?.user.uiLanguage ?? locale;
    return isLanguageCode(preferred) ? preferred : "en";
  });
  // Set once the language is confirmed, so its chip can fly up into the header.
  const [committed, setCommitted] = useState(false);

  // Creating the classroom turns a visitor into a guest mid-step; the notes step stays mounted.
  if (step !== "notes" && session && isPending) {
    return <FullPageSpinner />;
  }
  // The guided start is for someone with nothing yet; everyone else lands on their classrooms.
  // The notes step creates the classroom, so it keeps the screen until it hands off.
  if (
    step !== "notes" &&
    !needsOnboarding(session, classroomList?.classrooms.length ?? 0)
  ) {
    return <Navigate to="/classrooms" replace />;
  }

  const go = (next: Step) => {
    setDirection(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const skip = async () => {
    await markOnboarded(session, queryClient);
    router.push("/classrooms");
  };

  const languageName = targetLanguage
    ? languageLabel(targetLanguage, locale)
    : "";

  return (
    <LayoutGroup>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col sm:min-h-[calc(100dvh-5rem)]">
        <header className="flex items-center gap-3 sm:gap-5">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <StepRail
              current={step === "notes" ? 1 : 0}
              started={step !== "welcome"}
              labels={[t("steps.language"), t("steps.notes")]}
            />
          </div>
          {committed && targetLanguage ? (
            <motion.span
              layoutId={`language-${targetLanguage}`}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="hidden shrink-0 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1 font-heading text-sm font-semibold text-primary sm:inline-block"
            >
              {languageName}
            </motion.span>
          ) : null}
          {step !== "notes" ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => void skip()}
            >
              {t("skip")}
            </Button>
          ) : null}
        </header>

        <div className="relative flex flex-1 flex-col pt-8 sm:pt-12">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={SCREEN}
              initial="enter"
              animate="shown"
              exit="leave"
              className="flex flex-1 flex-col"
            >
              {step === "welcome" ? (
                <WelcomeStep onStart={() => go("language")} />
              ) : null}
              {step === "language" ? (
                <LanguageStep
                  targetLanguage={targetLanguage}
                  nativeLanguage={nativeLanguage}
                  committed={committed}
                  onTargetChange={(code) => {
                    setCommitted(false);
                    setTargetLanguage(code);
                  }}
                  onNativeChange={setNativeLanguage}
                  onContinue={() => {
                    setCommitted(true);
                    go("notes");
                  }}
                  onExample={() => {
                    setCommitted(true);
                    go("tour");
                  }}
                />
              ) : null}
              {step === "tour" && targetLanguage ? (
                <PaperTour
                  language={targetLanguage}
                  languageName={languageName}
                  onBack={() => go("language")}
                  onDone={() => go("notes")}
                />
              ) : null}
              {step === "notes" && targetLanguage ? (
                <NotesStep
                  targetLanguage={targetLanguage}
                  nativeLanguage={nativeLanguage}
                  languageName={languageName}
                  signedIn={signedIn}
                  onBack={() => go("language")}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}
