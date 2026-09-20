"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OmitKnowledgePointButton({
  knowledgePointId,
  isOmitted: controlledOmitted,
  onToggle,
  className,
}: {
  knowledgePointId: string;
  isOmitted?: boolean;
  onToggle?: (omitted: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("Quiz.QuestionReview");
  const [uncontrolledOmitted, setUncontrolledOmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const omitted = controlledOmitted !== undefined ? controlledOmitted : uncontrolledOmitted;

  const toggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (loading) return;

    const nextState = !omitted;
    if (controlledOmitted === undefined) {
      setUncontrolledOmitted(nextState);
    }
    onToggle?.(nextState);
    setLoading(true);

    try {
      const response = await fetch(`/api/knowledge-points/${knowledgePointId}/omit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ omit: nextState }),
      });
      if (!response.ok) {
        throw new Error("Failed to update");
      }
      toast.success(nextState ? t("omitSuccess") : t("restoreSuccess"));
    } catch {
      if (controlledOmitted === undefined) {
        setUncontrolledOmitted(!nextState);
      }
      onToggle?.(!nextState);
      toast.error(t("omitError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={toggle}
      disabled={loading}
      className={cn(
        "h-6 rounded-full px-2.5 text-[0.72rem] font-medium transition-colors",
        omitted
          ? "border-primary/35 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
          : "text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
        className,
      )}
      title={omitted ? t("restoreKnowledgePoint") : t("omitKnowledgePointHint")}
      aria-pressed={omitted}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : omitted ? (
        <CheckCircle2 className="size-3 text-primary" />
      ) : (
        <Sparkles className="size-3 text-muted-foreground" />
      )}
      <span>{omitted ? t("knowledgePointOmitted") : t("omitKnowledgePoint")}</span>
    </Button>
  );
}
