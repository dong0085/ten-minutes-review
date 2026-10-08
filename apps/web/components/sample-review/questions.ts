import type { UiLocale } from "@tmr/core";
import type { QuizQuestion } from "@/spa/components/quiz/types";
import type { AnswerShape } from "@/spa/components/quiz/question-review";

/** A homepage sample question, graded in the browser since it is only a demo. */
export type SampleQuestion = QuizQuestion & {
  correctAnswer: AnswerShape;
  /** Accepted answers for a blank, compared after `normalizeBlank`. */
  accept?: string[];
  explanation: string;
};

/*
 * Three questions per site language, one of each form, at a moderate level
 * for someone learning that language. Correct options sit away from "A".
 */
export const SAMPLE_QUESTIONS: Record<UiLocale, SampleQuestion[]> = {
  en: [
    {
      id: "sample-en-1",
      position: 1,
      category: "vocabulary",
      type: "mcq",
      stem: "Which word is closest in meaning to “reluctant”?",
      options: ["eager", "unwilling", "careless", "curious"],
      correctAnswer: { index: 1 },
      explanation:
        "“Reluctant” means you don’t really want to do something, so it is close to “unwilling”.",
    },
    {
      id: "sample-en-2",
      position: 2,
      category: "grammar",
      type: "true_false",
      stem: "“If I would have known, I would have come” is correct standard English.",
      options: null,
      correctAnswer: { value: false },
      explanation:
        "After “if”, standard English uses the past perfect: “If I had known, I would have come.”",
    },
    {
      id: "sample-en-3",
      position: 3,
      category: "phrase",
      type: "fill_blank",
      stem: "Could you fill ___ this form before your appointment?",
      options: null,
      correctAnswer: { blanks: ["in / out"] },
      accept: ["in", "out"],
      explanation: "“Fill in” and “fill out” both mean to complete a form.",
    },
  ],
  fr: [
    {
      id: "sample-fr-1",
      position: 1,
      category: "vocabulary",
      type: "mcq",
      stem: "Quel mot veut dire « très fatigué » ?",
      options: ["ravi", "épuisé", "inquiet", "étonné"],
      correctAnswer: { index: 1 },
      explanation:
        "« Épuisé » veut dire très fatigué. « Ravi » veut dire très content, « inquiet » veut dire soucieux.",
    },
    {
      id: "sample-fr-2",
      position: 2,
      category: "grammar",
      type: "true_false",
      stem: "La phrase « Il faut que tu viens demain » est correcte.",
      options: null,
      correctAnswer: { value: false },
      explanation:
        "Après « il faut que », on emploie le subjonctif : « Il faut que tu viennes demain. »",
    },
    {
      id: "sample-fr-3",
      position: 3,
      category: "phrase",
      type: "fill_blank",
      stem: "Pendant les vacances, elle a ___ soin de son petit frère.",
      options: null,
      correctAnswer: { blanks: ["pris"] },
      accept: ["pris"],
      explanation:
        "On dit « prendre soin de quelqu’un ». Au passé composé : « elle a pris soin de… »",
    },
  ],
  zh: [
    {
      id: "sample-zh-1",
      position: 1,
      category: "vocabulary",
      type: "mcq",
      stem: "哪个词的意思是“非常累”？",
      options: ["兴高采烈", "精疲力竭", "小心翼翼", "半途而废"],
      correctAnswer: { index: 1 },
      explanation:
        "“精疲力竭”指体力和精力都用完了，也就是非常累。“兴高采烈”是非常高兴。",
    },
    {
      id: "sample-zh-2",
      position: 2,
      category: "grammar",
      type: "true_false",
      stem: "“我吃饭了昨天。”这个句子的语序是对的。",
      options: null,
      correctAnswer: { value: false },
      explanation: "时间词要放在动词前面：“我昨天吃饭了。”",
    },
    {
      id: "sample-zh-3",
      position: 3,
      category: "phrase",
      type: "fill_blank",
      stem: "虽然今天下雨，___我们还是去了公园。",
      options: null,
      correctAnswer: { blanks: ["但是"] },
      accept: ["但是", "可是", "但", "不过"],
      explanation: "“虽然……但是……”是一对常用的关联词，表示转折。也可以说“可是”或“不过”。",
    },
  ],
};

/** Lower-cases a typed answer and drops stray spaces and end punctuation. */
export function normalizeBlank(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.!?,;:。！？，；：]+$/u, "");
}
