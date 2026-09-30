export const APP_NAME = "Ten Minutes Review";

export const DEFAULT_AUTO_STOP_DAYS = 7;

export const ACTIVE_WINDOW_DAYS = 7;

export const DAILY_SEND_HOUR_LOCAL = 7;

export const DAILY_SEND_TIMEZONE = "America/Toronto";

export const FREE_TIER = {
  classrooms: 3,
  attemptsPerQuizPerDay: 5,
  notesUploadsPerWeek: 1,
} as const;

export const MONTHLY_PRICE_USD = 2.99;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const MAX_UPLOADS_PER_USER_PER_DAY = 50;

export const MAX_LLM_CALLS_PER_USER_PER_DAY = 200;

export const JOB_STALE_MINUTES = 10;

export const JOB_MAX_ATTEMPTS = 3;

/** How long the classroom hub keeps showing a compose job still in flight after it was requested. */
export const COMPOSE_REHYDRATE_MS = 60 * 60 * 1000;

/** How long a new on-demand quiz keeps its own card on the classroom hub. */
export const RECENT_ON_DEMAND_MS = 24 * 60 * 60 * 1000;

export const RECENT_ON_DEMAND_LIMIT = 3;

export const MIN_USABLE_QUESTIONS = 5;

/** How long an unsubmitted attempt token, and the browser draft behind it, stays valid. */
export const ATTEMPT_TTL_MS = 2 * 60 * 60 * 1000;
