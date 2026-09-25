import { useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Dot,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { QUIZ_LENGTHS, type QuizLength } from "@tmr/core";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Card, CardContent } from "@tmr/ui/components/card";
import { cn } from "@tmr/ui/utils";
import { useRouter } from "@/lib/router";

const LEVELS: Record<
  QuizLength,
  {
    icon: LucideIcon;
    label: "levelMuchShorter" | "levelShorter" | "levelStandard" | "levelLonger" | "levelMuchLonger";
    minutes: number;
  }
> = {
  [-2]: { icon: ChevronsLeft, label: "levelMuchShorter", minutes: 5 },
  [-1]: { icon: ChevronLeft, label: "levelShorter", minutes: 8 },
  0: { icon: Dot, label: "levelStandard", minutes: 10 },
  1: { icon: ChevronRight, label: "levelLonger", minutes: 15 },
  2: { icon: ChevronsRight, label: "levelMuchLonger", minutes: 20 },
};

export function QuizLengthSettings({
  classroomId,
  initialLength,
}: {
  classroomId: string;
  initialLength: QuizLength;
}) {
  const t = useTranslations("Classroom.QuizLength");
  const router = useRouter();
  const [length, setLength] = useState<QuizLength>(initialLength);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  async function choose(next: QuizLength) {
    if (next === length) {
      return;
    }
    const previous = length;
    setLength(next);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quizLength: next }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setLength(previous);
        setError(body?.error ?? t("error"));
        return;
      }
      router.refresh();
    } catch {
      setLength(previous);
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const position = QUIZ_LENGTHS.indexOf(length) + step;
    const next = QUIZ_LENGTHS[position];
    if (next !== undefined) {
      buttonRefs.current[position]?.focus();
      void choose(next);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.025em]">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("help")}</p>
        </div>
        <div
          role="radiogroup"
          aria-label={t("title")}
          aria-busy={pending}
          className="grid grid-cols-5 gap-2"
          onKeyDown={onKeyDown}
        >
          {QUIZ_LENGTHS.map((value, index) => {
            const { icon: Icon, label } = LEVELS[value];
            const selected = value === length;
            return (
              <button
                key={value}
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(label)}
                title={t(label)}
                tabIndex={selected ? 0 : -1}
                onClick={() => void choose(value)}
                className={cn(
                  "grid h-11 place-items-center rounded-xl border transition outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-card/45 text-muted-foreground hover:border-primary/20 hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className={value === 0 ? "size-7" : "size-5"} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <p className="text-sm font-medium" aria-live="polite">
          {t(LEVELS[length].label)} · {t("minutes", { minutes: LEVELS[length].minutes })}
        </p>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
