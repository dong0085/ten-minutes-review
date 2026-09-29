import {
  languageName,
  parseJsonFromLlmText,
  usageFromChatCompletion,
} from "@tmr/core";
import { reportLlmUsage, withLlmTracking } from "@tmr/db";
import type {
  Category,
  CompositionQuestion,
  CompositionResult,
  ExtractionResult,
} from "@tmr/core";
import { env } from "./env";

export type LlmImage = {
  bytes: Uint8Array;
  mimeType: string;
};

export type ExtractInput = {
  systemPrompt: string;
  text?: string | null;
  images?: LlmImage[];
  targetHint?: string | null;
};

export type ComposeInput = {
  systemPrompt: string;
  payload: unknown;
};

export type LlmProvider = {
  extract(input: ExtractInput): Promise<unknown>;
  compose(input: ComposeInput): Promise<unknown>;
  summarize(input: ComposeInput): Promise<unknown>;
  tutor(input: ComposeInput): Promise<unknown>;
};

export type TutorPayload = {
  mode: "hint" | "analysis";
  targetLanguage: string;
  nativeLanguage: string;
  writeIn: string;
  question: {
    type: string;
    category: string;
    stem: string;
    options: string[] | null;
    explanation: string;
    rightAnswer: string;
  };
  knowledgePoint: { target: string | null; native: string | null };
  level?: number;
  earlierHints?: string[];
  learnerAnswer?: string;
  missCount?: number;
};

export type ExamReviewMiss = {
  number: number;
  type: "mcq" | "true_false" | "fill_blank";
  category: Category;
  knowledgePoint: { target: string | null; native: string | null };
  stem: string;
  options: string[] | null;
  learnerAnswer: string;
  rightAnswer: string;
  explanation: string;
};

export type ExamReviewPayload = {
  targetLanguage: string;
  nativeLanguage: string;
  writeIn: string;
  score: { earned: number; total: number };
  parts: { type: string; correct: number; count: number }[];
  misses: ExamReviewMiss[];
};

export type CompositionKnowledgePoint = {
  id: string;
  category: Category;
  target: string;
  native: string | null;
  detail: unknown;
  /** Set on exam points: the question type the point must be tested with. */
  type?: "mcq" | "true_false" | "fill_blank";
};

export type CompositionMiss = {
  knowledgePointId: string;
  stem: string;
};

export type CompositionPayload = {
  targetLanguage: string;
  nativeLanguage: string;
  size: number;
  knowledgePoints: CompositionKnowledgePoint[];
  alreadyAskedStems: string[];
  recentMisses: CompositionMiss[];
};

function normalizeStem(stem: string): string {
  return stem.trim().toLowerCase();
}

function uniqueStem(stem: string, asked: Set<string>, used: Set<string>): string {
  let candidate = stem;
  let variant = 2;
  while (asked.has(normalizeStem(candidate)) || used.has(normalizeStem(candidate))) {
    candidate = `${stem} (variante ${variant})`;
    variant += 1;
  }
  used.add(normalizeStem(candidate));
  return candidate;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function grammarRuleOf(detail: unknown): string | null {
  const grammar = asRecord(asRecord(detail)?.grammar);
  const rule = grammar?.rule;
  return typeof rule === "string" && rule.trim() ? rule : null;
}

function passageRefOf(detail: unknown): string | number | null {
  const value = asRecord(detail)?.passage_ref;
  return typeof value === "string" || typeof value === "number" ? value : null;
}

const LANGUAGE_LABELS_FR: Record<string, string> = {
  zh: "mandarin",
  es: "espagnol",
  en: "anglais",
  hi: "hindi",
  pt: "portugais",
  bn: "bengali",
  ru: "russe",
  ja: "japonais",
  vi: "vietnamien",
  ko: "coréen",
  fr: "français",
};

function languageLabel(code: string): string {
  return LANGUAGE_LABELS_FR[code] ?? languageName(code) ?? code;
}

function chooseDistractors(
  payload: CompositionPayload,
  point: CompositionKnowledgePoint,
  key: "target" | "native",
  count: number,
): string[] {
  const own = key === "target" ? point.target : point.native;
  const ordered = [
    ...payload.knowledgePoints.filter(
      (candidate) => candidate.id !== point.id && candidate.category === point.category,
    ),
    ...payload.knowledgePoints.filter(
      (candidate) => candidate.id !== point.id && candidate.category !== point.category,
    ),
  ];
  const values: string[] = [];
  for (const candidate of ordered) {
    const value = key === "target" ? candidate.target : candidate.native;
    const trimmed = value?.trim();
    if (!trimmed || trimmed === own?.trim() || values.includes(trimmed)) {
      continue;
    }
    values.push(trimmed);
    if (values.length >= count) {
      break;
    }
  }
  return values;
}

function buildMcq(input: {
  point: CompositionKnowledgePoint;
  payload: CompositionPayload;
  rotation: number;
  stem: string;
  correct: string;
  distractorKey: "target" | "native";
  explanation: string;
}): CompositionQuestion {
  const distractors = chooseDistractors(input.payload, input.point, input.distractorKey, 3);
  const options = [input.correct, ...distractors.filter((value) => value !== input.correct)].slice(
    0,
    4,
  );
  const shift =
    (((options.indexOf(input.correct) - input.rotation) % options.length) + options.length) %
    options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return {
    knowledge_point_id: input.point.id,
    category: input.point.category,
    type: "mcq",
    stem: input.stem,
    options: rotated,
    answer: { index: rotated.indexOf(input.correct) },
    explanation: input.explanation,
  };
}

const COMPREHENSION_DISTRACTORS = [
  "L'âme disparaît complètement après la mort.",
  "La mort marque la fin définitive de la conscience.",
  "La prochaine vie commence immédiatement après la mort.",
];

function buildQuestion(
  point: CompositionKnowledgePoint,
  payload: CompositionPayload,
  rotation: number,
): CompositionQuestion | null {
  const target = point.target.trim();
  if (!target) {
    return null;
  }
  const native = point.native?.trim() || null;

  switch (point.category) {
    case "vocabulary": {
      if (!native) {
        return buildMcq({
          point,
          payload,
          rotation,
          stem: `Quelle forme correspond à « ${target} » ?`,
          correct: target,
          distractorKey: "target",
          explanation: `La bonne réponse est « ${target} ».`,
        });
      }
      const production = rotation % 3 !== 2;
      if (production) {
        return buildMcq({
          point,
          payload,
          rotation,
          stem: `Comment dit-on « ${native} » en ${languageLabel(payload.targetLanguage)} ?`,
          correct: target,
          distractorKey: "target",
          explanation: `« ${target} » se traduit par « ${native} ».`,
        });
      }
      return buildMcq({
        point,
        payload,
        rotation,
        stem: `« ${target} » veut dire :`,
        correct: native,
        distractorKey: "native",
        explanation: `« ${target} » veut dire « ${native} ».`,
      });
    }
    case "phrase": {
      if (!native) {
        return buildMcq({
          point,
          payload,
          rotation,
          stem: `Quelle expression correspond à « ${target} » ?`,
          correct: target,
          distractorKey: "target",
          explanation: `La bonne expression est « ${target} ».`,
        });
      }
      const production = rotation % 2 === 0;
      return buildMcq({
        point,
        payload,
        rotation,
        stem: production
          ? `Comment dit-on « ${native} » en ${languageLabel(payload.targetLanguage)} ?`
          : `« ${target} » veut dire :`,
        correct: production ? target : native,
        distractorKey: production ? "target" : "native",
        explanation: `« ${target} » correspond à « ${native} ».`,
      });
    }
    case "grammar": {
      const rule = grammarRuleOf(point.detail);
      if (rule) {
        return {
          knowledge_point_id: point.id,
          category: "grammar",
          type: "true_false",
          stem: `Vrai ou faux : ${rule}`,
          options: null,
          answer: { value: true },
          explanation: `Cette règle est correcte : ${rule}`,
        };
      }
      return buildMcq({
        point,
        payload,
        rotation,
        stem: `Quelle forme suit la règle « ${target} » ?`,
        correct: target,
        distractorKey: "target",
        explanation: `La règle « ${target} » est la bonne.`,
      });
    }
    case "expression": {
      if (!native) {
        return buildMcq({
          point,
          payload,
          rotation,
          stem: `Quelle phrase correspond à « ${target} » ?`,
          correct: target,
          distractorKey: "target",
          explanation: `La bonne phrase est « ${target} ».`,
        });
      }
      return buildMcq({
        point,
        payload,
        rotation,
        stem: `Comment exprime-t-on « ${native} » en ${languageLabel(payload.targetLanguage)} ?`,
        correct: target,
        distractorKey: "target",
        explanation: `« ${target} » exprime « ${native} ».`,
      });
    }
    case "comprehension": {
      const reference = passageRefOf(point.detail);
      const stem =
        reference !== null
          ? `D'après le passage ${String(reference)}, quelle affirmation est correcte ?`
          : "D'après le passage, quelle affirmation est correcte ?";
      const options = [target, ...COMPREHENSION_DISTRACTORS];
      const shift = rotation % options.length;
      const rotated = [...options.slice(shift), ...options.slice(0, shift)];
      return {
        knowledge_point_id: point.id,
        category: "comprehension",
        type: "mcq",
        stem,
        options: rotated,
        answer: { index: rotated.indexOf(target) },
        explanation: "Le passage présente cette idée ; les autres affirmations la contredisent.",
      };
    }
  }
}

function mockExtraction(input: ExtractInput): ExtractionResult {
  const hint = input.targetHint?.trim().toLowerCase();
  const targetLanguage = hint && /^[a-z]{2}$/.test(hint) ? hint : "fr";
  return {
    subject: "Home vocabulary, emotions, and a Buddhist passage",
    target_language: targetLanguage,
    native_language: "en",
    knowledge_points: [
      {
        category: "vocabulary",
        target_text: "l'étendoir",
        native_text: "the clothes line",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "étendoir - clothe line",
      },
      {
        category: "vocabulary",
        target_text: "le linge",
        native_text: "the laundry",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "le linge = laundry",
      },
      {
        category: "vocabulary",
        target_text: "l'anxiété",
        native_text: "anxiety",
        inferred: true,
        note: "gloss inferred from context",
        grammar: null,
        passage_ref: null,
        source_excerpt: "anxiété",
      },
      {
        category: "phrase",
        target_text: "apprendre à lâcher prise",
        native_text: "learn to let go",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "apprendre à lâcher prise = let go",
      },
      {
        category: "phrase",
        target_text: "au fil des jours",
        native_text: "as the days went by",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "au fil des jours",
      },
      {
        category: "grammar",
        target_text: "adjectif → nom",
        native_text: "adjective → noun",
        inferred: false,
        note: null,
        grammar: {
          rule: "Un adjectif devient un nom en changeant de forme et en prenant un genre.",
          examples: [
            { target: "heureux", related: "le bonheur" },
            { target: "triste", related: "la tristesse" },
            { target: "en colère", related: "la colère" },
          ],
        },
        passage_ref: null,
        source_excerpt: "noun et adjective différence",
      },
      {
        category: "grammar",
        target_text: "le subjonctif après « il faut que »",
        native_text: "subjunctive after “il faut que”",
        inferred: false,
        note: null,
        grammar: {
          rule: "« Il faut que » est suivi du subjonctif.",
          examples: [
            { target: "il faut que je parte", related: null },
            { target: "il faut que tu fasses", related: null },
          ],
        },
        passage_ref: null,
        source_excerpt: "il faut que + subjonctif",
      },
      {
        category: "expression",
        target_text: "Au fil des jours, j'accumulais de l'anxiété.",
        native_text: "As the days went by, I was accumulating anxiety.",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "au fil des jours, j'accumulais de l'anxiété",
      },
      {
        category: "expression",
        target_text: "J'apprends à lâcher prise petit à petit.",
        native_text: "I am learning to let go little by little.",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "j'apprends à lâcher prise petit à petit",
      },
      {
        category: "comprehension",
        target_text:
          "Après la mort, l'âme entre dans l'univers et se prépare pour une prochaine vie.",
        native_text:
          "After death, the soul enters the universe and prepares for a next life.",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: 0,
        source_excerpt: "pour les bouddhistes, après la mort, l'âme entre dans l'univers...",
      },
    ],
    passages: [
      {
        target_text:
          "Pour les bouddhistes, après la mort, l'âme entre dans l'univers et se prépare pour une prochaine vie.",
        native_text:
          "For Buddhists, after death, the soul enters the universe and prepares for a next life.",
        source_excerpt: "pour les bouddhistes, après la mort, l'âme entre dans l'univers...",
      },
    ],
    discarded: [
      { line: "tension au bibeau", reason: "unintelligible" },
      { line: "Pilates", reason: "no gloss and no surrounding context" },
    ],
  };
}

// Exam points arrive with the type they must be tested with.
function buildTypedQuestion(
  point: CompositionKnowledgePoint,
  payload: CompositionPayload,
  rotation: number,
): CompositionQuestion | null {
  const target = point.target.trim();
  const native = point.native?.trim() || null;
  if (!target) {
    return null;
  }
  if (point.type === "fill_blank") {
    return {
      knowledge_point_id: point.id,
      category: point.category,
      type: "fill_blank",
      stem: `Complétez : ___ (${native ?? target})`,
      options: null,
      answer: { blanks: [target] },
      explanation: `La réponse attendue est « ${target} ».`,
    };
  }
  if (point.type === "true_false") {
    const isTrue = rotation % 2 === 0 || !native;
    const shown = isTrue ? native ?? target : chooseDistractors(payload, point, "native", 1)[0] ?? "rien";
    return {
      knowledge_point_id: point.id,
      category: point.category,
      type: "true_false",
      stem: `Vrai ou faux : « ${target} » veut dire « ${shown} ».`,
      options: null,
      answer: { value: isTrue },
      explanation: native ? `« ${target} » veut dire « ${native} ».` : `« ${target} » est correct.`,
    };
  }
  const built = buildQuestion(point, payload, rotation);
  if (built?.type === "mcq") {
    return built;
  }
  return buildMcq({
    point,
    payload,
    rotation,
    stem: `Quelle forme correspond à « ${native ?? target} » ?`,
    correct: target,
    distractorKey: "target",
    explanation: `La bonne réponse est « ${target} ».`,
  });
}

function mockComposition(payload: CompositionPayload): CompositionResult {
  const asked = new Set(payload.alreadyAskedStems.map(normalizeStem));
  const used = new Set<string>();
  const questions: CompositionQuestion[] = [];
  const isExam = payload.knowledgePoints.some((point) => point.type);
  const points = isExam ? payload.knowledgePoints : payload.knowledgePoints.slice(0, 12);

  for (const [index, point] of points.entries()) {
    const question = isExam
      ? buildTypedQuestion(point, payload, index)
      : buildQuestion(point, payload, index);
    if (!question) {
      continue;
    }
    questions.push({ ...question, stem: uniqueStem(question.stem, asked, used) });
  }

  for (const miss of isExam ? [] : payload.recentMisses.slice(0, 2)) {
    const point = payload.knowledgePoints.find(
      (candidate) => candidate.id === miss.knowledgePointId,
    );
    if (!point) {
      continue;
    }
    const rotation = payload.knowledgePoints.indexOf(point);
    const question = buildQuestion(point, payload, rotation);
    if (!question) {
      continue;
    }
    questions.push({ ...question, stem: uniqueStem(`Rappel — ${question.stem}`, asked, used) });
  }

  return { quiz_date: new Date().toISOString().slice(0, 10), questions };
}

// Groups the misses by category, so local runs show a believable review.
function mockExamReview(payload: ExamReviewPayload) {
  const byCategory = new Map<string, ExamReviewMiss[]>();
  for (const miss of payload.misses) {
    byCategory.set(miss.category, [...(byCategory.get(miss.category) ?? []), miss]);
  }
  const groups = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length);
  return {
    overview: `${payload.score.earned} / ${payload.score.total}. Most points went on ${groups[0]?.[0] ?? "a few slips"}.`,
    patterns: groups.slice(0, 4).map(([category, misses]) => ({
      title: `Mixing up ${category}`,
      detail: misses
        .slice(0, 2)
        .map((miss) => `You wrote « ${miss.learnerAnswer} » where « ${miss.rightAnswer} » was expected.`)
        .join(" "),
      questions: misses.map((miss) => miss.number),
    })),
    next_steps: groups.slice(0, 2).map(([category]) => `Redo five ${category} questions tomorrow.`),
  };
}

// Canned tutor replies, so local runs exercise the whole flow.
function mockTutor(payload: TutorPayload) {
  if (payload.mode === "hint") {
    const hints = [
      `Look closely at the ${payload.question.category} this question tests. Which clue in the sentence decides it?`,
      `Recall the rule behind « ${payload.knowledgePoint.native ?? "this point"} ». How does it apply here?`,
      "Rule out the option that breaks that rule first. What is left?",
    ];
    return { hint: hints[Math.min((payload.level ?? 1) - 1, hints.length - 1)] };
  }
  return {
    diagnosis: `You answered « ${payload.learnerAnswer ?? ""} », which suggests the two forms feel interchangeable.`,
    rule: payload.question.explanation,
    examples: [{ target: payload.knowledgePoint.target ?? "", translation: payload.knowledgePoint.native ?? "" }],
    tip: "Say the whole phrase aloud with its article before you choose.",
  };
}

export function createMockProvider(): LlmProvider {
  return {
    async extract(input) {
      return mockExtraction(input);
    },
    async compose(input) {
      const payload = asRecord(input.payload);
      return mockComposition({
        targetLanguage:
          typeof payload?.targetLanguage === "string" ? payload.targetLanguage : "fr",
        nativeLanguage: typeof payload?.nativeLanguage === "string" ? payload.nativeLanguage : "en",
        size: typeof payload?.size === "number" ? payload.size : 0,
        knowledgePoints: Array.isArray(payload?.knowledgePoints)
          ? (payload.knowledgePoints as CompositionPayload["knowledgePoints"])
          : [],
        alreadyAskedStems: Array.isArray(payload?.alreadyAskedStems)
          ? (payload.alreadyAskedStems as string[])
          : [],
        recentMisses: Array.isArray(payload?.recentMisses)
          ? (payload.recentMisses as CompositionPayload["recentMisses"])
          : [],
      });
    },
    async summarize(input) {
      return mockExamReview(input.payload as ExamReviewPayload);
    },
    async tutor(input) {
      return mockTutor(input.payload as TutorPayload);
    },
  };
}

function createDeepseekProvider(): LlmProvider {
  async function chat(systemPrompt: string, userContent: unknown): Promise<unknown> {
    const base = env.deepseekBaseUrl.replace(/\/+$/, "");
    const response = await fetch(`${base}/chat/completions`, {
      signal: AbortSignal.timeout(120_000),
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: env.deepseekModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      throw new Error(`DeepSeek request failed (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: unknown;
    };
    reportLlmUsage(usageFromChatCompletion(data.usage));
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek response is missing message content");
    }
    return parseJsonFromLlmText(content);
  }

  return {
    extract(input) {
      const parts: unknown[] = [];
      const text = [input.targetHint ? `Target language hint: ${input.targetHint}.` : null, input.text]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join("\n\n");
      if (text) {
        parts.push({ type: "text", text });
      }
      for (const image of input.images ?? []) {
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`,
          },
        });
      }
      return chat(input.systemPrompt, parts.length > 0 ? parts : [{ type: "text", text: "" }]);
    },
    compose(input) {
      return chat(input.systemPrompt, JSON.stringify(input.payload));
    },
    summarize(input) {
      return chat(input.systemPrompt, JSON.stringify(input.payload));
    },
    tutor(input) {
      return chat(input.systemPrompt, JSON.stringify(input.payload));
    },
  };
}

export function getLlmProvider(): LlmProvider {
  if (env.llmProvider === "deepseek") {
    return withLlmTracking(createDeepseekProvider(), { provider: "deepseek", model: env.deepseekModel });
  }
  return withLlmTracking(createMockProvider(), { provider: "mock", model: "mock" });
}
