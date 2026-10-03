export const CATEGORIES = [
  "vocabulary",
  "phrase",
  "grammar",
  "expression",
  "comprehension",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const QUESTION_TYPES = ["mcq", "fill_blank", "true_false", "image"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const UPLOAD_KINDS = ["text", "image"] as const;

export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const EXTRACTION_STATUSES = ["pending", "running", "done", "failed"] as const;

export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const JOB_KINDS = ["extract", "compose", "send_email", "summarize", "tutor"] as const;

export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = ["pending", "running", "done", "failed", "cancelled"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const QUIZ_KINDS = ["daily", "manual", "exam"] as const;

export type QuizKind = (typeof QUIZ_KINDS)[number];

export const TOKEN_PURPOSES = ["verify_email", "reset_password", "invite"] as const;

export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

export const REFERRAL_STATUSES = ["created", "signed_up", "rewarded"] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export type GrammarExample = {
  target: string;
  related: string | null;
};

export type GrammarDetail = {
  rule: string;
  examples: GrammarExample[];
};

export type KnowledgePointDetail =
  | { grammar: GrammarDetail }
  | { passage_ref: number }
  | null;

export type McqAnswer = { index: number };

export type FillBlankAnswer = {
  blanks: string[];
  /** Other answers marked right, per blank: accepted[i] holds the alternatives to blanks[i]. */
  accepted?: string[][];
};

export type TrueFalseAnswer = { value: boolean };

export type QuestionAnswer = McqAnswer | FillBlankAnswer | TrueFalseAnswer;

export type QuestionResponse = {
  index?: number | null;
  blanks?: (string | null)[];
  value?: boolean | null;
};

export type ExtractionKnowledgePoint = {
  category: Category;
  target_text: string | null;
  native_text: string | null;
  inferred: boolean;
  note: string | null;
  grammar: GrammarDetail | null;
  passage_ref: number | null;
  source_excerpt: string | null;
  /** 1-based numbers of the note lines the point came from; empty for images. */
  lines?: number[];
};

export type ExtractionPassage = {
  target_text: string;
  native_text: string | null;
  source_excerpt: string | null;
  lines?: number[];
};

export type ExtractionDiscard = {
  line: string;
  reason: string;
};

export type ExtractionResult = {
  subject: string | null;
  target_language: string;
  native_language: string;
  knowledge_points: ExtractionKnowledgePoint[];
  passages: ExtractionPassage[];
  discarded: ExtractionDiscard[];
};

export type RereadUpdate = ExtractionKnowledgePoint & { ref: string };

/** What the model returns when it re-reads the edited part of a note. */
export type RereadResult = {
  subject: string | null;
  updates: RereadUpdate[];
  removals: string[];
  knowledge_points: ExtractionKnowledgePoint[];
  passages: ExtractionPassage[];
  discarded: ExtractionDiscard[];
};

export type CompositionQuestion = {
  knowledge_point_id: string;
  category: Category;
  type: QuestionType;
  stem: string;
  options: string[] | null;
  answer: QuestionAnswer;
  explanation: string;
};

export type CompositionResult = {
  quiz_date: string;
  questions: CompositionQuestion[];
};

export type ScheduledQuizQuestion = {
  id: string;
  quizId: string;
  knowledgePointId: string;
  passageId: string | null;
  position: number;
  category: Category;
  type: QuestionType;
  stem: string;
  options: string[] | null;
  answer: QuestionAnswer;
  explanation: string;
  promptVersion: string;
};

export type AttemptResult = {
  questionId: string;
  isCorrect: boolean;
};
