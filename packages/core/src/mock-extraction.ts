import type { ExtractionKnowledgePoint, ExtractionResult, RereadResult } from "./types";

// The mock LLM reads "term = gloss" style lines, so local runs exercise line
// links and note edits without a model. Anything else on a line is skipped.
const SEPARATOR = /\s+(?:=|-|–|—|:)\s+|\s*=\s*/;

function parsePair(text: string): { target: string; native: string } | null {
  const line = text.trim();
  const match = SEPARATOR.exec(line);
  if (!match || match.index === 0) {
    return null;
  }
  const target = line.slice(0, match.index).trim();
  const native = line.slice(match.index + match[0].length).trim();
  return target && native ? { target, native } : null;
}

function vocabulary(target: string, native: string, line: number, excerpt: string): ExtractionKnowledgePoint {
  return {
    category: "vocabulary",
    target_text: target,
    native_text: native,
    inferred: false,
    note: null,
    grammar: null,
    passage_ref: null,
    source_excerpt: excerpt,
    lines: [line],
  };
}

/** A first reading of typed notes, or null when no line reads as a pair. */
export function mockLineExtraction(
  text: string,
  languages: { target: string; native: string },
): ExtractionResult | null {
  const points: ExtractionKnowledgePoint[] = [];
  const discarded: ExtractionResult["discarded"] = [];
  text.split("\n").forEach((raw, index) => {
    const line = raw.replace(/^\d+\|\s?/, "");
    if (!line.trim()) {
      return;
    }
    const pair = parsePair(line);
    if (pair) {
      points.push(vocabulary(pair.target, pair.native, index + 1, line.trim()));
    } else {
      discarded.push({ line: line.trim(), reason: "no gloss" });
    }
  });
  if (points.length === 0) {
    return null;
  }
  return {
    subject: "Lesson vocabulary",
    target_language: languages.target,
    native_language: languages.native,
    knowledge_points: points,
    passages: [],
    discarded,
  };
}

type MockRereadPayload = {
  lines?: { n: number; text: string; editable: boolean }[];
  points?: { ref: string; target_text: string; native_text: string | null; lines: number[] }[];
};

/** A re-reading: reviewed points follow their line, and new pairs become new points. */
export function mockReread(payload: MockRereadPayload): RereadResult {
  const lines = payload.lines ?? [];
  const byNumber = new Map(lines.map((line) => [line.n, line] as const));
  const covered = new Set<number>();
  const result: RereadResult = {
    subject: null,
    updates: [],
    removals: [],
    knowledge_points: [],
    passages: [],
    discarded: [],
  };
  for (const point of payload.points ?? []) {
    const line = point.lines.map((n) => byNumber.get(n)).find(Boolean);
    const pair = line ? parsePair(line.text) : null;
    if (!line || !pair) {
      result.removals.push(point.ref);
      continue;
    }
    covered.add(line.n);
    if (pair.target !== point.target_text || pair.native !== point.native_text) {
      result.updates.push({ ...vocabulary(pair.target, pair.native, line.n, line.text.trim()), ref: point.ref });
    }
  }
  for (const line of lines) {
    if (!line.editable || covered.has(line.n) || !line.text.trim()) {
      continue;
    }
    const pair = parsePair(line.text);
    if (pair) {
      result.knowledge_points.push(vocabulary(pair.target, pair.native, line.n, line.text.trim()));
    } else {
      result.discarded.push({ line: line.text.trim(), reason: "no gloss" });
    }
  }
  return result;
}
