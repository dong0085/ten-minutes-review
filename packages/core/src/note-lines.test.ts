import { describe, expect, it } from "vitest";
import {
  diffNoteLines,
  matchExcerptToLines,
  planNoteEdit,
  previewNoteLines,
  splitLongNoteLines,
  splitNoteLine,
  splitNoteLines,
} from "./note-lines";
import type { StoredNoteLine, StoredNotePoint } from "./note-lines";

function lines(...texts: string[]): StoredNoteLine[] {
  return texts.map((text, index) => ({ id: `l${index + 1}`, text }));
}

function point(id: string, lineIds: string[], extra: Partial<StoredNotePoint> = {}): StoredNotePoint {
  return {
    id,
    category: "vocabulary",
    targetText: id,
    nativeText: null,
    note: null,
    inferred: false,
    grammar: null,
    passageId: null,
    lineIds,
    userEdited: false,
    ...extra,
  };
}

function ids() {
  let next = 0;
  return () => `new${(next += 1)}`;
}

describe("splitNoteLines", () => {
  it("keeps blank lines and normalizes line endings", () => {
    expect(splitNoteLines("a\r\n\r\nb\rc")).toEqual(["a", "", "b", "c"]);
  });
});

describe("diffNoteLines", () => {
  it("pairs an edited line as changed", () => {
    expect(diffNoteLines(["a", "b", "c"], ["a", "B", "c"])).toEqual([
      { kind: "same", oldIndex: 0, newIndex: 0 },
      { kind: "changed", oldIndex: 1, newIndex: 1 },
      { kind: "same", oldIndex: 2, newIndex: 2 },
    ]);
  });

  it("reports inserted and deleted lines between matches", () => {
    const changes = diffNoteLines(["a", "b", "c", "d"], ["a", "x", "y", "b", "d"]);
    expect(changes).toEqual([
      { kind: "same", oldIndex: 0, newIndex: 0 },
      { kind: "added", newIndex: 1 },
      { kind: "added", newIndex: 2 },
      { kind: "same", oldIndex: 1, newIndex: 3 },
      { kind: "removed", oldIndex: 2 },
      { kind: "same", oldIndex: 3, newIndex: 4 },
    ]);
  });

  it("ignores trailing spaces", () => {
    expect(diffNoteLines(["a  "], ["a"])).toEqual([{ kind: "same", oldIndex: 0, newIndex: 0 }]);
  });
});

describe("matchExcerptToLines", () => {
  const note = lines("étendoir - clothe line", "le linge = laundry", "signe", "assigner = assign");

  it("prefers an exact line", () => {
    expect(matchExcerptToLines("signe", note)).toEqual(["l3"]);
  });

  it("finds the one line that contains the excerpt", () => {
    expect(matchExcerptToLines("le linge", note)).toEqual(["l2"]);
  });

  it("links nothing when several lines contain the excerpt", () => {
    expect(matchExcerptToLines("ign", note)).toEqual([]);
  });

  it("links every line of a multi-line excerpt", () => {
    expect(matchExcerptToLines("étendoir - clothe line le linge = laundry", note)).toEqual(["l1", "l2"]);
  });
});

describe("planNoteEdit", () => {
  const note = lines("chien = dog", "chat = cat", "oiseau = bird");
  const points = [point("dog", ["l1"]), point("cat", ["l2"]), point("bird", ["l3"])];

  it("leaves points on unchanged lines alone and sends points on changed lines", () => {
    const plan = planNoteEdit({
      lines: note,
      newText: "chien = dog\nchat = a cat\noiseau = bird",
      points,
      passages: [],
      newId: ids(),
    });
    expect(plan.lines.map((line) => line.id)).toEqual(["l1", "l2", "l3"]);
    expect(plan.points.map((entry) => entry.point.id)).toEqual(["cat"]);
    expect(plan.retirePointIds).toEqual([]);
    expect(plan.window.filter((line) => line.editable).map((line) => line.number)).toEqual([2]);
    expect(plan.contextPoints.map((entry) => entry.id)).toEqual(["dog", "bird"]);
  });

  it("retires points whose lines are deleted, without a reading", () => {
    const plan = planNoteEdit({
      lines: note,
      newText: "chien = dog\noiseau = bird",
      points,
      passages: [],
      newId: ids(),
    });
    expect(plan.removedLineIds).toEqual(["l2"]);
    expect(plan.retirePointIds).toEqual(["cat"]);
    expect(plan.window).toEqual([]);
  });

  it("gives added lines new ids and marks them editable", () => {
    const plan = planNoteEdit({
      lines: note,
      newText: "chien = dog\nchat = cat\nvache = cow\noiseau = bird",
      points,
      passages: [],
      newId: ids(),
    });
    expect(plan.lines.map((line) => line.id)).toEqual(["l1", "l2", "new1", "l3"]);
    expect(plan.points).toEqual([]);
    expect(plan.window.find((line) => line.editable)).toMatchObject({ number: 3, lineId: "new1" });
  });

  it("keeps hand-edited points and reports them", () => {
    const plan = planNoteEdit({
      lines: note,
      newText: "chien = dog\noiseau = bird",
      points: [point("dog", ["l1"]), point("cat", ["l2"], { userEdited: true })],
      passages: [],
      newId: ids(),
    });
    expect(plan.retirePointIds).toEqual([]);
    expect(plan.keptEditedPointIds).toEqual(["cat"]);
  });

  it("replaces a touched passage with its comprehension points", () => {
    const plan = planNoteEdit({
      lines: lines("Il était une fois", "un roi.", "chat = cat"),
      newText: "Il était une fois\nune reine.\nchat = cat",
      points: [
        point("story", [], { category: "comprehension", passageId: "passage1" }),
        point("cat", ["l3"]),
      ],
      passages: [{ id: "passage1", lineIds: ["l1", "l2"] }],
      newId: ids(),
    });
    expect(plan.retirePassageIds).toEqual(["passage1"]);
    expect(plan.retirePointIds).toEqual(["story"]);
    expect(plan.window.filter((line) => line.editable).map((line) => line.number)).toEqual([1, 2]);
  });

  it("sends every point when re-reading the whole note", () => {
    const plan = planNoteEdit({ lines: note, newText: null, points, passages: [], newId: ids() });
    expect(plan.full).toBe(true);
    expect(plan.points.map((entry) => entry.ref)).toEqual(["p1", "p2", "p3"]);
    expect(plan.window.every((line) => line.editable)).toBe(true);
  });

  it("keeps points saved before lines existed out of an edit", () => {
    const plan = planNoteEdit({
      lines: note,
      newText: "chien = dog\nchat = a cat\noiseau = bird",
      points: [point("legacy", [])],
      passages: [],
      newId: ids(),
    });
    expect(plan.points).toEqual([]);
    expect(plan.contextPoints.map((entry) => entry.id)).toEqual(["legacy"]);
  });
});

describe("previewNoteLines", () => {
  const long = `Hier on a parlé du linge. Le linge sèche sur l'étendoir; il fait beau. ${"Encore une phrase. ".repeat(6)}`;

  it("counts lines with text and keeps blank ones numbered", () => {
    const preview = previewNoteLines("chien = dog\n\nchat = cat\n");
    expect(preview.lines).toEqual(["chien = dog", "", "chat = cat"]);
    expect(preview.filledCount).toBe(2);
    expect(preview.longLines).toEqual([]);
  });

  it("flags long lines that can be split", () => {
    expect(previewNoteLines(`chien = dog\n${long}`).longLines).toEqual([1]);
    expect(previewNoteLines("x".repeat(200)).longLines).toEqual([]);
  });

  it("splits at sentence ends, semicolons, and bullets, but not at a gloss dash", () => {
    expect(splitNoteLine("étendoir - clothe line; linge = laundry • Il fait beau. Oui!")).toEqual([
      "étendoir - clothe line",
      "linge = laundry",
      "Il fait beau.",
      "Oui!",
    ]);
  });

  it("splits only the long lines", () => {
    const result = splitLongNoteLines(`chien = dog. chat = cat\n${long}`);
    const lines = result.split("\n");
    expect(lines[0]).toBe("chien = dog. chat = cat");
    expect(lines[1]).toBe("Hier on a parlé du linge.");
    expect(lines.length).toBeGreaterThan(4);
  });
});
