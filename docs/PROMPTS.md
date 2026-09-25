# Prompt Spec

Two prompts carry the product.

- **Extraction** turns a session's notes into knowledge points.
- **Composition** turns knowledge points into one day's quiz.

Both are versioned. Every question row stores the `prompt_version` that produced it, so a quality regression traces back to a prompt change.

---

## 1. Extraction

**Runs:** once per upload, in the worker, right after the upload is stored.
**Input:** the upload's text, plus any attached images.
**Output:** a short subject line, knowledge points, passages, and an explicit list of discarded lines.

### The five categories

| Category | What belongs here | Example from a real session |
|---|---|---|
| `vocabulary` | One term and its gloss | `étendoir` → the clothes line |
| `phrase` | A fixed multi-word expression | `apprendre à lâcher prise` → learn to let go |
| `grammar` | A rule the notes teach, with its examples | noun ↔ adjective: `heureux` / `le bonheur` |
| `expression` | A full sentence worth producing | `Au fil des jours, j'accumulais de l'anxiété.` |
| `comprehension` | A passage plus questions about it | the Buddhist monk paragraph |

### System prompt

```
You turn a language learner's raw session notes into structured study material.

The notes come from a live tutoring session and were written down quickly.
Expect no consistent separator between entries, entries with no translation,
misspellings, fragments, and lines that are simply garbled.

Extract what is genuinely studyable. Discard the rest.

Rules:

1. Classify every extracted item into exactly one of: vocabulary, phrase,
   grammar, expression, comprehension.

2. Detect the language being learned (target) and the language the glosses are
   written in (native). Report both as ISO 639-1 codes.

3. Never invent a gloss. When a term carries no translation in the notes, you
   may infer one from context and set "inferred": true. When you cannot infer
   it confidently, discard the line.

4. Discard any line that is garbled, unintelligible, or carries nothing
   studyable. List every discard with a short reason. Discarding is correct
   behaviour, not a failure. A missing question costs the learner nothing; a
   wrong one costs them trust.

5. Grammar arrives as teaching, not as a list. When the notes state a rule —
   even in shorthand like "noun et adjective différence" — capture the rule
   together with the examples that belong to it.

6. Preserve the target-language spelling exactly as written. Correct an obvious
   typo only when you are confident, and record the correction in "note".

7. Emit one knowledge point per item. Two distinct terms are two knowledge
   points.

8. Write explanations in the target language.

9. Write "subject": a short subject line, three to eight words, naming the topic
   the notes cover, in the native language. Name the theme, not the first line.

10. Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
<schema>
```

### Output schema

```json
{
  "subject": "Home vocabulary, emotions, and a Buddhist passage",
  "target_language": "fr",
  "native_language": "en",
  "knowledge_points": [
    {
      "category": "vocabulary",
      "target_text": "l'étendoir",
      "native_text": "the clothes line",
      "inferred": false,
      "note": null,
      "source_excerpt": "étendoir - clothe line"
    },
    {
      "category": "grammar",
      "target_text": "adjectif → nom",
      "native_text": "adjective → noun",
      "inferred": false,
      "note": null,
      "grammar": {
        "rule": "An adjective becomes a noun by changing form and taking a gender.",
        "examples": [
          { "target": "heureux", "related": "le bonheur" },
          { "target": "triste", "related": "la tristesse" },
          { "target": "en colère", "related": "la colère" }
        ]
      },
      "source_excerpt": "noun et adjective différence"
    }
  ],
  "passages": [
    {
      "target_text": "Pour les bouddhistes, après la mort, l'âme entre dans l'univers et se prépare pour une prochaine vie.",
      "native_text": "For Buddhists, after death, the soul enters the universe and prepares for a next life.",
      "source_excerpt": "pour les bouddhistes, après la mort, l'âme entre dans l'univers..."
    }
  ],
  "discarded": [
    { "line": "tension au bibeau", "reason": "unintelligible" },
    { "line": "Pilates", "reason": "no gloss and no surrounding context" }
  ]
}
```

`note` carries a correction or a caveat. It is `null` on a clean extraction.

`subject` is the short native-language title the upload lists show as the row title.

### Category-specific payloads

| Category | Extra field | Shape |
|---|---|---|
| `vocabulary` | — | `target_text` and `native_text` carry the pair |
| `phrase` | — | same |
| `grammar` | `grammar` | `{ rule, examples[] }` |
| `expression` | — | `target_text` is the full sentence, `native_text` its translation |
| `comprehension` | `passage_ref` | index into `passages` |

### What the real notes proved

Taken from the trial run in `TRIAL-RUN.md`:

- **Mess is normal.** No consistent separator, several entries with no gloss at all (`signe`, `maintenir`, `par exemple`), one misspelling (`ischio-jambièrs`), one garbled line (`tension au bibeau`). Rule 4 exists because of the garbled line. A strict parser turns `au bibeau` into a quiz question.
- **Grammar is taught inline.** `noun et adjective différence` is a teaching note sitting in a vocabulary list. Rule 5 exists because of it.
- **One session mixes topics.** Home, Buddhism, emotions, Pilates, and language anxiety all appear together. Extraction keeps them as separate points; composition decides the daily mix.
- **The gloss direction is stable.** French is the target throughout, English the native language. Detection is cheap here, but rule 2 keeps it honest for mixed decks.

### Failure handling

- Malformed JSON → retry once, appending the raw response with an instruction to correct it.
- A knowledge point with no `target_text` → drop it, log it.
- A `passage_ref` pointing at a missing passage → drop the dependent point.
- Every discard is stored on the upload row so the behaviour is auditable.

---

## 2. Composition

**Runs:** once per classroom per day, before the email goes out.
**Input:** the knowledge points chosen for the day (see Point selection), the questions already asked this week, the misses on those points, and the day's target size.
**Output:** one question per point. The worker shuffles them into the final order.

### System prompt

```
You write one day's quiz for a language learner, drawn from their own session
notes.

You receive the knowledge points already chosen for today, the questions the
learner has already seen this week, and the questions they answered wrong on
some of today's points. Write a quiz they can finish in about ten minutes.

Rules:

1. Write exactly one question for each knowledge point you receive, in the order
   you receive them. The list runs a few points past the quiz size on purpose;
   write a question for every point anyway.

2. Never repeat a question the learner has already seen this week. Re-testing a
   knowledge point is good. Reusing the wording is not. Reword it.

3. When a point has a question the learner answered wrong, test the same point
   with a new question. Reword it; never reuse the missed stem.

4. Vocabulary runs both directions. Ask production (native → target) more often
   than recognition (target → native). Recognition is easier and flatters the
   learner. A production question must carry the native cue: in a fill_blank,
   put the native word or phrase in parentheses right after the blank, as in
   "Elle se met du ___ (lipstick) tous les matins avant de sortir."

5. Pick the question type that serves each category best:

   vocabulary    → mcq, fill_blank, image
   phrase        → mcq, fill_blank
   grammar       → true_false, fill_blank
   expression    → mcq, fill_blank
   comprehension → the passage, plus mcq, true_false, fill_blank about it

   A grammar drill with several blanks is one fill_blank question, not several.

6. Write questions and explanations in the target language, except the native
   cue that a production question carries.

7. Every question carries a one-sentence explanation of why the answer is right.

8. Output JSON only, matching the schema below. No prose, no markdown fence.

Schema:
<schema>
```

### Output schema

```json
{
  "quiz_date": "2026-09-10",
  "questions": [
    {
      "knowledge_point_id": "b1f2...",
      "category": "vocabulary",
      "type": "mcq",
      "stem": "« l'étendoir » veut dire :",
      "options": ["the clothes line", "the ceiling", "the rent", "the hamstring"],
      "answer": { "index": 0 },
      "explanation": "Un étendoir est l'objet sur lequel on fait sécher le linge."
    },
    {
      "knowledge_point_id": "a7d3...",
      "category": "vocabulary",
      "type": "fill_blank",
      "stem": "Elle se met du ___ (lipstick) tous les matins avant de sortir.",
      "options": null,
      "answer": { "blanks": ["rouge à lèvres"] },
      "explanation": "« Le rouge à lèvres » est le produit de maquillage des lèvres."
    },
    {
      "knowledge_point_id": "c9a4...",
      "category": "grammar",
      "type": "fill_blank",
      "stem": "Donnez le nom : heureux → ____ ; triste → ____ ; en colère → ____",
      "options": null,
      "answer": { "blanks": ["le bonheur", "la tristesse", "la colère"] },
      "explanation": "Chaque adjectif d'émotion a un nom correspondant, avec son genre."
    }
  ]
}
```

### Answer shapes by type

| Type | `answer` shape |
|---|---|
| `mcq` | `{ "index": 2 }` |
| `fill_blank` | `{ "blanks": ["le bonheur", "la tristesse"] }` |
| `true_false` | `{ "value": false }` |
| `image` | `{ "index": 0 }` — the stem points at a retained upload image |

Text blanks compare case-insensitively and ignore accents, so `etendoir` marks correct against `étendoir`.

### Point selection

Code picks the points, and the model only writes questions. `selectCompositionPoints` in `packages/core/src/composition-selection.ts` builds the list in priority order:

1. **Misses** — up to 2 points answered wrong in the last 30 days, picked at random.
2. **Recent** — points added in the last 7 days, picked at random, up to half the budget.
3. **Due** — older points ranked by how long since they were last in a quiz, never-quizzed first. The pick is random among the top 2× needed, so two days in a row differ.
4. **Backfill** — any remaining points, at random, when a group runs short.

Points fill a time budget of `min(20, max(8, floor(bank_size / 8)))` standard questions, multiplied by the classroom's quiz length setting (`quizBudget`). A vocabulary point counts as half a standard question and every other category as one (`CATEGORY_WEIGHTS` in `packages/core/src/quiz-size.ts`), so a vocabulary-heavy day holds more questions. The list ends with 3 spare points, so questions dropped as invalid still leave a full quiz. The model sees only the chosen points, the stems asked in the last 7 days (rule 2), and the misses on the chosen points (rule 3). The worker keeps usable questions in list order while they fit the budget, then shuffles them, keeping questions about one passage together.

### Failure handling

- A question referencing a point outside the chosen list is dropped; the spare points fill the gap.
- An `mcq` whose `answer.index` falls outside `options` is dropped.
- Fewer than 5 usable questions → the quiz is not sent; the classroom is flagged for review. For an on-demand quiz the compose job fails and the user can retry.
- A daily quiz is composed once per classroom per day. The partial unique index on `(classroom_id, quiz_date) WHERE kind = 'daily'` makes a retry safe. On-demand quizzes share the same prompt and selection rules and can be composed at any time.

---

## 3. Versioning

- Both prompts live in code as named constants: `EXTRACTION_PROMPT_V2`, `COMPOSITION_PROMPT_V3`.
- Every `knowledge_point` and every `question` row stores the version that produced it.
- Bumping a version affects new work only. Existing rows keep their original version, so old and new output can be compared side by side.
