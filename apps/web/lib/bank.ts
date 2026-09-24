import type { Category } from "@tmr/core";
import type { KnowledgePoint } from "@tmr/db";

export type KnowledgePointJson = {
  id: string;
  category: Category;
  targetText: string;
  nativeText: string | null;
  note: string | null;
  inferred: boolean;
  sourceExcerpt: string | null;
  isRetired: boolean;
  retiredAt: string | null;
  createdAt: string;
};

// A bank row also carries how often the learner answered questions built on it.
export type BankItem = KnowledgePointJson & { answered: number; missed: number };

export function toKnowledgePointJson(point: KnowledgePoint): KnowledgePointJson {
  return {
    id: point.id,
    category: point.category,
    targetText: point.targetText,
    nativeText: point.nativeText,
    note: point.note,
    inferred: point.inferred,
    sourceExcerpt: point.sourceExcerpt,
    isRetired: point.retiredAt !== null,
    retiredAt: point.retiredAt ? point.retiredAt.toISOString() : null,
    createdAt: point.createdAt.toISOString(),
  };
}

export function toBankItem(point: KnowledgePoint, answered: number, missed: number): BankItem {
  return { ...toKnowledgePointJson(point), answered, missed };
}
