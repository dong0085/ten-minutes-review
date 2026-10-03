# Prompt Spec

Two prompts carry the product.

- **Extraction** turns a session's notes into knowledge points.
- **Composition** turns knowledge points into one day's quiz.

Two more serve exams: **Exam** writes the 40-question paper, and **Exam review** reads its mistakes for patterns. **Tutor** gives hints and explains wrong answers on Corrections.

Both are versioned. Every question row stores the `prompt_version` that produced it, so a quality regression traces back to a prompt change.

---

## 1. Extraction

**Runs:** once per upload, in the worker, right after the upload is stored.
**Input:** the upload's text as numbered lines (`12| text`, blank lines keep their number), or the image.
**Output:** a short subject line, knowledge points, passages, and an explicit list of discarded lines. Every point and passage cites the `lines` it came from.

The prompt in code is `EXTRACTION_PROMPT_V3` (`v3`): the V2 rules below plus rule 10, which asks for `lines`. The server checks each cited number against the note; an item whose numbers do not exist is linked by matching its `source_excerpt` to a line, and an item that matches none is saved without lines. Image notes have no lines.

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

### Re-reading an edited note

**Runs:** when the learner edits a typed note or asks to read a note again (`REREAD_PROMPT_V1`, `reread-v1`).
**Input:** JSON with the changed part of the note — `lines` as `{ n, text, editable }`, where editable lines changed or belong to points under review and the rest are a few lines of context — the existing `points` on those lines, each with a short `ref`, and `other_points` from the same note, which the model must not repeat. `full` is true when the whole note is read again.
**Output:** `updates` (same item, corrected, by `ref`), `removals` (refs), new `knowledge_points` and `passages`, and `discarded`. A point left out of the reply stays as it is.

The model only sees points the plan allows it to change, and the server keeps only what that plan allows: an update or removal must name a ref it was shown, a ref named twice or both updated and removed is left alone, every line number must be one it was shown, a new item must cite an editable line, and a new point that repeats a kept point is dropped. Points the learner edited by hand are sent as `other_points` only.

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

6. A fill_blank is graded by exact match, ignoring accents and capitals, so
   keep each blank short: one word or a short phrase, at most four words. The
   rest of the sentence stays in the stem. To test a whole sentence or a long
   expression, use mcq instead of asking the learner to type it.
   In "accepted", list for each blank every other answer a teacher would mark
   right: spelling variants (paie, paye) and synonyms that fit the cue. Put
   each one back into the sentence first: it must read correctly with the words
   around the blank ("un ___" takes "billete", never "el billete"), and it must
   still show the point being tested (a por/para drill accepts only por or
   para). accepted[0] holds the alternatives to blanks[0], and so on. Use []
   for a blank with no alternative.

7. Write questions and explanations in the target language, except the native
   cue that a production question carries.

8. Every question carries a one-sentence explanation of why the answer is right.

9. The stem never contains the answer. A learner who matches words between the
   stem and the options must still have to know the point. "Quel objet sert à
   faire sécher le linge dehors ?" works; adding "… est un étendoir ?" gives it
   away. Wrong options are plausible mix-ups from the same topic, not
   obviously unrelated things.

10. Output JSON only, matching the schema below. No prose, no markdown fence.

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
      "answer": {
        "blanks": ["le bonheur", "la tristesse", "la colère"],
        "accepted": [["bonheur"], ["tristesse"], ["colère"]]
      },
      "explanation": "Chaque adjectif d'émotion a un nom correspondant, avec son genre."
    }
  ]
}
```

### Answer shapes by type

| Type | `answer` shape |
|---|---|
| `mcq` | `{ "index": 2 }` |
| `fill_blank` | `{ "blanks": ["je paie"], "accepted": [["je paye"]] }` — `accepted` is optional, one list per blank |
| `true_false` | `{ "value": false }` |
| `image` | `{ "index": 0 }` — the stem points at a retained upload image |

Text blanks compare case-insensitively and ignore accents, curly apostrophes, and closing punctuation, so `etendoir` marks correct against `étendoir` and `on va voir` against `On va voir.` A blank also marks correct against any answer in its `accepted` list. Screens show only `blanks`. The worker drops a fill_blank whose blank runs past four words.

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
- An `mcq` whose explanation leads with a different option is dropped.
- A vocabulary, phrase, or expression question whose stem contains its answer is dropped. Grammar stems name the forms they drill, so they pass.
- With `JUDGE_PROVIDER=jev`, TypeSafe's Jev reviews every usable question (`apps/worker/src/review.ts`). It returns a probability for each problem — the stem reveals the answer, the answer is wrong, several answers are right, the wrong options are easy to rule out — and a quality score from 0 to 4. A true_false has no options, so it is asked only whether the verdict is wrong, whether the statement can be read either way, and for quality. A question with any problem at 0.5 or above, or quality below 1.5, goes back to the model once with `REWRITE_PROMPT_V2`, along with the rejected question and Jev's numbers. A rewrite that passes takes its place; one that fails again is set aside, and the spare points fill the gap. Set-aside questions come back only when the quiz would otherwise fall under 5. When Jev is unreachable, the question stays unreviewed and the quiz still goes out.
- Fewer than 5 usable questions → the quiz is not sent; the classroom is flagged for review. For an on-demand quiz the compose job fails and the user can retry.
- A daily quiz is composed once per classroom per day. The partial unique index on `(classroom_id, quiz_date) WHERE kind = 'daily'` makes a retry safe. On-demand quizzes share the same prompt and selection rules and can be composed at any time.

### Evaluating the composition prompt

`apps/worker/src/eval` scores the prompt on fixed cases, so a prompt or model change is measured before it ships. It reads and writes no database.

- `pnpm --filter worker eval` runs every case: the four synthetic cases in `src/eval/cases`, plus real ones in `.eval/cases`. Flags: `--prompt <file>` tries a draft prompt, `--runs N` repeats each case, `--label`, `--only <name>`, `--no-judge`. `DEEPSEEK_MODEL` picks the model.
- Each question gets the worker's code checks (drops, option count, blank count, missing cue, repeated stem) and an LLM judge that checks it against a short list: answer correct, one right answer, no giveaway, plausible distractors, clear cue, natural language, and a 1–5 score.
- Results land in `apps/worker/.eval/results/<time>-<label>/`: `report.md` lists every question with its flags, `results.json` holds the raw run.
- `pnpm --filter worker eval:compare <dir> <dir>` puts two runs side by side.
- A case whose points carry a `type` is an exam case and runs with `EXAM_PROMPT_V2`; `src/eval/cases/fr-exam.json` is one. `--review` adds the Jev review-and-rewrite step, so `eval --label plain` and `eval --review --label jev` compare the pipeline with and without it. `pnpm --filter worker eval:jev-calibrate` runs Jev on seven questions with a known verdict, to check the review questions and thresholds.
- `pnpm --filter worker eval:snapshot <classroomId> [name]` saves the payload today's quiz would send for a real classroom into `.eval/cases`. Git ignores `.eval/`, since those cases hold real notes.

The judge runs on the same model it grades and reads some native cues as giveaways, so its rates carry noise of a few points between runs. Read the flagged questions in `report.md` before trusting a small difference.

---

## 2b. Exam

**Runs:** when a Pro member starts an exam.
**Input:** the composition payload, except each knowledge point carries the `type` it must be tested with (`mcq`, `true_false`, or `fill_blank`).
**Output:** the composition schema, one question per point, in the given type.

`EXAM_PROMPT_V2` (`packages/core/src/prompts/exam.ts`) keeps the composition rules on rewording, misses, production cues, and target-language output, and adds: never change the type; test use rather than recall of the notes; four options with plausible distractors for mcq; short fill_blank answers with an `accepted` list of alternatives; true_false statements clearly true or false, mixed evenly. The worker drops any question whose type differs from its point's, then fills 20 / 10 / 10 in part order; a short part fails the job. With `JUDGE_PROVIDER=jev`, the questions of the right type go through the same Jev review and rewrite as the daily quiz; a rewrite keeps the type. Set-aside questions come back, best quality first, only for a part the spares cannot fill.

## 2c. Exam review

**Runs:** after a Pro member submits an exam with at least one miss.
**Input:** `writeIn` (the learner's interface language), the target and native languages, the score and per-part tallies, and each missed question with its paper number, type, knowledge point, stem, options, the learner's answer, the right answer, and the printed explanation.
**Output:** `{ overview, patterns: [{ title, detail, questions }], next_steps }`.

`EXAM_REVIEW_PROMPT_V1` (`packages/core/src/prompts/exam-review.ts`) asks for one to four patterns — habits that show in more than one answer — ordered by points lost, each grounded in quotes of the learner's own answers and the rule that fixes it, plus one to three concrete next steps. The learner has already read each question's explanation, so the review stays at the level of what the mistakes share. `parseExamReview` drops question numbers outside the missed set and caps the lists.

## 2d. Tutor

**Runs:** when a Pro member asks the tutor about a Corrections question.
**Input:** the question (stem, type, options, explanation, right answer), the knowledge point, `writeIn`, and either `level` with `earlierHints` (hint) or `learnerAnswer` with `missCount` (analysis).
**Output:** `{ hint }`, or `{ diagnosis, rule, examples: [{ target, translation }], tip }`.

`TUTOR_HINT_PROMPT_V1` (`packages/core/src/prompts/tutor.ts`) gives one hint that moves the learner a step closer: level 1 points at what to notice, level 2 recalls the rule with a different example, level 3 walks the reasoning to the last step and may rule out one option. It never states the right option, word, letter, or true/false, and never repeats an earlier hint. `parseTutorHint` rejects any hint containing the right option text or a blank of three or more letters, so the job retries. `TUTOR_ANALYSIS_PROMPT_V1` runs after a wrong answer, when the right answer is already on screen: it names the belief behind the learner's answer, explains the rule, gives one or two fresh examples, and one check for next time.

## 3. Versioning

- The prompts live in code as named constants: `EXTRACTION_PROMPT_V3` (built from V2's rules), `REREAD_PROMPT_V1`, `COMPOSITION_PROMPT_V4`, `EXAM_PROMPT_V2`, `EXAM_REVIEW_PROMPT_V1`, `TUTOR_HINT_PROMPT_V1`, `TUTOR_ANALYSIS_PROMPT_V1` (both `tutor-v1`).
- Every `knowledge_point` and every `question` row stores the version that produced it (a point updated by a re-read carries `reread-v1`), and an attempt's review stores its own in `review_prompt_version`.
- Bumping a version affects new work only. Existing rows keep their original version, so old and new output can be compared side by side.
