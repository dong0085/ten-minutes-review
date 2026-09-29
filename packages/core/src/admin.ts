import { FREE_TIER, MAX_UPLOADS_PER_USER_PER_DAY } from "./constants";

export const LLM_PURPOSES = ["extract", "compose", "summarize", "tutor"] as const;

export type LlmPurpose = (typeof LLM_PURPOSES)[number];

/** Limits the admin console can change at runtime. */
export type AppLimits = {
  freeClassrooms: number;
  freeNotesUploadsPerMonth: number;
  uploadsPerUserPerDay: number;
};

export const DEFAULT_APP_LIMITS: AppLimits = {
  freeClassrooms: FREE_TIER.classrooms,
  freeNotesUploadsPerMonth: FREE_TIER.notesUploadsPerMonth,
  uploadsPerUserPerDay: MAX_UPLOADS_PER_USER_PER_DAY,
};

/** USD per million tokens. */
export type LlmPrices = {
  input: number;
  cachedInput: number;
  output: number;
};

export const DEFAULT_LLM_PRICES: LlmPrices = {
  input: 0.28,
  cachedInput: 0.028,
  output: 0.42,
};

export type TokenCounts = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/** `inputTokens` includes the cached ones; they are billed at the cached rate. */
export function llmCostUsd(tokens: TokenCounts, prices: LlmPrices): number {
  const cached = Math.min(tokens.cachedInputTokens, tokens.inputTokens);
  const fresh = tokens.inputTokens - cached;
  return (fresh * prices.input + cached * prices.cachedInput + tokens.outputTokens * prices.output) / 1e6;
}

/** Parses `ADMIN_EMAILS` (comma or whitespace separated) into lowercase addresses. */
export function parseAdminEmails(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Reads the `usage` block of an OpenAI-compatible chat completion (DeepSeek included). */
export function usageFromChatCompletion(usage: unknown): TokenCounts | null {
  if (!usage || typeof usage !== "object") {
    return null;
  }
  const record = usage as Record<string, unknown>;
  const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const details = record.prompt_tokens_details as Record<string, unknown> | undefined;
  return {
    inputTokens: count(record.prompt_tokens),
    cachedInputTokens: count(record.prompt_cache_hit_tokens) || count(details?.cached_tokens),
    outputTokens: count(record.completion_tokens),
  };
}
