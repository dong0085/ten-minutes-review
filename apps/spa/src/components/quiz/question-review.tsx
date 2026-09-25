
import { CATEGORIES, type Category } from "@tmr/core";
import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "use-intl";
import { Badge } from "@tmr/ui/components/badge";
import { Card, CardContent } from "@tmr/ui/components/card";
import { cn } from "@tmr/ui/utils";
import { OmitKnowledgePointButton } from "./omit-knowledge-point-button";

export type AnswerShape =
  | {
      index?: number | null;
      blanks?: (string | null)[] | null;
      value?: boolean | null;
    }
  | null
  | undefined;

export type ReviewCardQuestion = {
  position: number;
  category: string;
  type: string;
  stem: string;
  options: string[] | null;
  imageUrl?: string | null;
  knowledgePointId?: string;
  isKnowledgePointRetired?: boolean;
};

export function QuestionReviewCard({
  question,
  response,
  correctAnswer,
  isCorrect,
  explanation,
  onOmitToggle,
}: {
  question: ReviewCardQuestion;
  response: AnswerShape;
  correctAnswer?: AnswerShape;
  isCorrect?: boolean;
  explanation?: string;
  onOmitToggle?: (pointId: string, omitted: boolean) => void;
}) {
  const t = useTranslations("Quiz.QuestionReview");
  const categoryT = useTranslations("Category");
  const categoryLabel =
    CATEGORIES.includes(question.category as Category)
      ? categoryT(question.category as Category)
      : question.category;

  function formatAnswer(type: string, shape: AnswerShape, options: string[] | null): string {
    if (!shape) {
      return t("noAnswer");
    }
    if (type === "true_false") {
      if (shape.value === true) {
        return t("true");
      }
      if (shape.value === false) {
        return t("false");
      }
      return t("noAnswer");
    }
    if (type === "mcq" || type === "image") {
      if (typeof shape.index !== "number") {
        return t("noAnswer");
      }
      return options?.[shape.index] ?? t("option", { number: shape.index + 1 });
    }
    const blanks = shape.blanks ?? [];
    if (blanks.length === 0 || blanks.every((blank) => !blank || blank.trim() === "")) {
      return t("noAnswer");
    }
    return blanks.map((blank) => (blank && blank.trim() !== "" ? blank : "—")).join(", ");
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden bg-card/75",
        isCorrect === true && "border-success/20",
        isCorrect === false && "border-destructive/20",
      )}
    >
      {isCorrect !== undefined ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-5 left-0 w-px",
            isCorrect ? "bg-success/55" : "bg-destructive/55",
          )}
        />
      ) : null}
      <CardContent className="space-y-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-sm font-semibold italic text-muted-foreground">
              {t("question", { number: question.position })}
            </span>
            <Badge variant="secondary">{categoryLabel}</Badge>
            {question.knowledgePointId ? (
              <OmitKnowledgePointButton
                knowledgePointId={question.knowledgePointId}
                isOmitted={question.isKnowledgePointRetired}
                onToggle={(omitted) => onOmitToggle?.(question.knowledgePointId!, omitted)}
              />
            ) : null}
          </div>
          {isCorrect !== undefined ? (
            <Badge variant={isCorrect ? "success" : "destructive"}>
              {isCorrect ? <CheckCircle2 /> : <XCircle />}
              {isCorrect ? t("correct") : t("wrong")}
            </Badge>
          ) : null}
        </div>
        <h3 className="whitespace-pre-wrap font-heading text-xl leading-snug font-semibold tracking-[-0.015em]">
          {question.stem}
        </h3>
        {question.imageUrl ? (
          <img
            src={question.imageUrl}
            alt={t("handwritten")}
            className="max-h-72 rounded-xl border border-border/70 bg-muted/30 object-contain"
          />
        ) : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-border/65 bg-muted/30 px-3.5 py-3">
            <dt className="text-[0.68rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {t("yourAnswer")}
            </dt>
            <dd className={cn("mt-1.5", isCorrect === false && "font-medium text-destructive")}>
              {formatAnswer(question.type, response, question.options)}
            </dd>
          </div>
          {correctAnswer !== undefined ? (
            <div className="rounded-xl border border-success/15 bg-success/[0.045] px-3.5 py-3">
              <dt className="text-[0.68rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {t("correctAnswer")}
              </dt>
              <dd className="mt-1.5 font-medium text-success">
                {formatAnswer(question.type, correctAnswer, question.options)}
              </dd>
            </div>
          ) : null}
        </dl>
        {explanation ? (
          <div className="border-t border-border/65 pt-4">
            <p className="text-sm leading-6 text-muted-foreground">{explanation}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
