import { AsyncLocalStorage } from "node:async_hooks";
import type { LlmPurpose, TokenCounts } from "@tmr/core";
import type { Db } from "./client";
import { recordLlmCall } from "./repos/admin";

/** Who an LLM call works for. Calls made outside a scope go unrecorded. */
export type LlmScope = { db: Db; userId: string | null; jobId: string | null };

const scopeStore = new AsyncLocalStorage<LlmScope>();
const usageStore = new AsyncLocalStorage<{ usage: TokenCounts | null }>();

export function runInLlmScope<T>(scope: LlmScope, fn: () => Promise<T>): Promise<T> {
  return scopeStore.run(scope, fn);
}

/** Called by a provider once it has the token counts of the request in flight. */
export function reportLlmUsage(usage: TokenCounts | null) {
  const holder = usageStore.getStore();
  if (holder && usage) {
    holder.usage = usage;
  }
}

async function save(scope: LlmScope, row: Parameters<typeof recordLlmCall>[1]) {
  try {
    await recordLlmCall(scope.db, row);
  } catch (error) {
    console.warn("[llm] could not record call", error);
  }
}

export async function trackLlmCall<T>(
  meta: { purpose: LlmPurpose; provider: string; model: string },
  call: () => Promise<T>,
): Promise<T> {
  const scope = scopeStore.getStore();
  if (!scope) {
    return call();
  }
  const holder: { usage: TokenCounts | null } = { usage: null };
  const started = Date.now();
  const base = { ...meta, userId: scope.userId, jobId: scope.jobId };
  try {
    const result = await usageStore.run(holder, call);
    await save(scope, { ...base, ...holder.usage, durationMs: Date.now() - started, ok: true });
    return result;
  } catch (error) {
    await save(scope, {
      ...base,
      ...holder.usage,
      durationMs: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Wraps each method of a provider so every call lands in `llm_calls`. */
export function withLlmTracking<P extends Partial<Record<LlmPurpose, (input: never) => Promise<unknown>>>>(
  provider: P,
  meta: { provider: string; model: string },
): P {
  const wrapped = { ...provider };
  for (const purpose of Object.keys(provider) as LlmPurpose[]) {
    const method = provider[purpose];
    if (typeof method === "function") {
      (wrapped as Record<string, unknown>)[purpose] = (input: never) =>
        trackLlmCall({ purpose, ...meta }, () => method.call(provider, input));
    }
  }
  return wrapped;
}
