import { describe, expect, it } from "vitest";
import { llmCostUsd, parseAdminEmails, usageFromChatCompletion } from "./admin";

describe("llmCostUsd", () => {
  it("bills cached input at the cached rate", () => {
    const cost = llmCostUsd(
      { inputTokens: 1_000_000, cachedInputTokens: 400_000, outputTokens: 500_000 },
      { input: 1, cachedInput: 0.1, output: 2 },
    );
    expect(cost).toBeCloseTo(0.6 + 0.04 + 1);
  });

  it("caps cached tokens at the input count", () => {
    const cost = llmCostUsd(
      { inputTokens: 100, cachedInputTokens: 500, outputTokens: 0 },
      { input: 1, cachedInput: 0.5, output: 0 },
    );
    expect(cost).toBeCloseTo(50 / 1e6);
  });
});

describe("parseAdminEmails", () => {
  it("splits on commas and spaces and lowercases", () => {
    expect([...parseAdminEmails(" A@x.com, b@Y.com  c@z.com ")]).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
  });

  it("returns an empty set when unset", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
  });
});

describe("usageFromChatCompletion", () => {
  it("reads DeepSeek cache-hit tokens", () => {
    expect(
      usageFromChatCompletion({ prompt_tokens: 120, completion_tokens: 30, prompt_cache_hit_tokens: 100 }),
    ).toEqual({ inputTokens: 120, cachedInputTokens: 100, outputTokens: 30 });
  });

  it("reads OpenAI cached token details", () => {
    expect(
      usageFromChatCompletion({ prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 4 } }),
    ).toEqual({ inputTokens: 10, cachedInputTokens: 4, outputTokens: 2 });
  });

  it("returns null without usage", () => {
    expect(usageFromChatCompletion(undefined)).toBeNull();
  });
});
