import { describe, expect, it } from "vitest";
import {
  carriedOmits,
  mergeDiscards,
  resolveLineExtraction,
  resolveReread,
} from "./note-extraction";
import { planNoteEdit, pointKey } from "./note-lines";
import type { StoredNoteLine, StoredNotePoint } from "./note-lines";
import type { ExtractionKnowledgePoint, RereadResult } from "./types";

function lines(...texts: string[]): StoredNoteLine[] {
  return texts.map((text, index) => ({ id: `l${index + 1}`, text }));
}

function stored(id: string, targetText: string, lineIds: string[]): StoredNotePoint {
  return {
    id,
    category: "vocabulary",
    targetText,
    nativeText: null,
    note: null,
    inferred: false,
    grammar: null,
    passageId: null,
    lineIds,
    userEdited: false,
  };
}

function extracted(target: string, numbers: number[], excerpt: string | null = null): ExtractionKnowledgePoint {
  return {
    category: "vocabulary",
    target_text: target,
    native_text: null,
    inferred: false,
    note: null,
    grammar: null,
    passage_ref: null,
    source_excerpt: excerpt,
    lines: numbers,
  };
}

function reread(partial: Partial<RereadResult>): RereadResult {
  return {
    subject: null,
    updates: [],
    removals: [],
    knowledge_points: [],
    passages: [],
    discarded: [],
    ...partial,
  };
}

describe("resolveLineExtraction", () => {
  const note = lines("chien = dog", "chat = cat");

  it("links cited lines and rebuilds the excerpt from them", () => {
    const result = resolveLineExtraction(note, {
      subject: null,
      target_language: "fr",
      native_language: "en",
      knowledge_points: [extracted("chien", [1])],
      passages: [],
      discarded: [],
    });
    expect(result.points[0]).toMatchObject({ lineIds: ["l1"], sourceExcerpt: "chien = dog" });
  });

  it("falls back to the excerpt when the cited line does not exist", () => {
    const result = resolveLineExtraction(note, {
      subject: null,
      target_language: "fr",
      native_language: "en",
      knowledge_points: [extracted("chat", [9], "chat = cat"), extracted("loup", [], "loup")],
      passages: [],
      discarded: [],
    });
    expect(result.points.map((entry) => entry.lineIds)).toEqual([["l2"], []]);
  });
});

describe("resolveReread", () => {
  const note = lines("chien = dog", "chat = cat", "oiseau = bird");
  const points = [stored("dog", "chien", ["l1"]), stored("cat", "chat", ["l2"]), stored("bird", "oiseau", ["l3"])];
  const plan = planNoteEdit({
    lines: note,
    newText: "chien = dog\nchatte = cat\noiseau = bird\nvache = cow",
    points,
    passages: [],
    newId: () => "l4",
  });
  const kept = [pointKey("vocabulary", "chien"), pointKey("vocabulary", "oiseau")];

  it("applies an update to the point it names", () => {
    const result = resolveReread(plan, reread({ updates: [{ ...extracted("chatte", [2]), ref: "p1" }] }), kept);
    expect(result.updates).toEqual([
      expect.objectContaining({ pointId: "cat", targetText: "chatte", lineIds: ["l2"] }),
    ]);
  });

  it("ignores refs it never showed and refs both updated and removed", () => {
    const result = resolveReread(
      plan,
      reread({
        updates: [{ ...extracted("chatte", [2]), ref: "p1" }, { ...extracted("x", [2]), ref: "p9" }],
        removals: ["p1", "p9"],
      }),
      kept,
    );
    expect(result.updates).toEqual([]);
    expect(result.removePointIds).toEqual([]);
  });

  it("drops new points from context lines, unknown lines, or that repeat a kept point", () => {
    const result = resolveReread(
      plan,
      reread({
        knowledge_points: [
          extracted("vache", [4]),
          extracted("oiseau", [4]),
          extracted("chien", [1]),
          extracted("lapin", [42]),
        ],
      }),
      kept,
    );
    expect(result.points.map((entry) => entry.targetText)).toEqual(["vache"]);
  });

  it("removes a point the model removes", () => {
    const result = resolveReread(plan, reread({ removals: ["p1"] }), kept);
    expect(result.removePointIds).toEqual(["cat"]);
  });
});

describe("mergeDiscards", () => {
  it("keeps skipped lines that were not re-read", () => {
    const plan = planNoteEdit({
      lines: lines("garbled", "chat = cat"),
      newText: "garbled\nchat = a cat",
      points: [stored("cat", "chat", ["l2"])],
      passages: [],
      newId: () => "n",
    });
    expect(
      mergeDiscards([{ line: "garbled", reason: "unintelligible" }], [{ line: "x", reason: "y" }], plan),
    ).toEqual([
      { line: "garbled", reason: "unintelligible" },
      { line: "x", reason: "y" },
    ]);
  });
});

describe("carriedOmits", () => {
  it("carries an omit only across a one-to-one exact match", () => {
    const carried = carriedOmits(
      [
        { category: "vocabulary", targetText: "Chien", omitted: true },
        { category: "vocabulary", targetText: "chat", omitted: true },
        { category: "vocabulary", targetText: "chat", omitted: false },
      ],
      [
        { category: "vocabulary", targetText: "chien" },
        { category: "vocabulary", targetText: "chat" },
      ],
    );
    expect([...carried]).toEqual([0]);
  });
});
