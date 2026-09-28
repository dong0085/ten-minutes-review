/** The mistake book holds what was missed in the last this-many days. */
export const MISTAKE_WINDOW_DAYS = 30;

export const TUTOR_MODES = ["hint", "analysis"] as const;

export type TutorMode = (typeof TUTOR_MODES)[number];

/** Hints get closer each time, up to this many per question. */
export const TUTOR_MAX_HINTS = 3;

/** Detailed analyses a question can have, one per wrong answer. */
export const TUTOR_MAX_ANALYSES = 3;
