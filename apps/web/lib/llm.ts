import { parseJsonFromLlmText, usageFromChatCompletion } from "@tmr/core";
import { reportLlmUsage, withLlmTracking } from "@tmr/db";
import type { ExtractionResult } from "@tmr/core";
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

function mockExtraction(input: ExtractInput): ExtractionResult {
  return {
    subject: "Vocabulaire et expressions usuelles",
    target_language: input.targetHint ?? "fr",
    native_language: "en",
    knowledge_points: [
      {
        category: "vocabulary",
        target_text: "la confiance",
        native_text: "confidence",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "la confiance — confidence",
      },
      {
        category: "grammar",
        target_text: "il faut + infinitif",
        native_text: "one must / it is necessary to",
        inferred: false,
        note: null,
        grammar: {
          rule: "« Il faut » est toujours suivi de l'infinitif pour exprimer une nécessité générale.",
          examples: [{ target: "Il faut prendre soin de soi.", related: null }],
        },
        passage_ref: null,
        source_excerpt: "il faut + infinitif",
      },
      {
        category: "expression",
        target_text: "prendre soin de",
        native_text: "to take care of",
        inferred: false,
        note: null,
        grammar: null,
        passage_ref: null,
        source_excerpt: "prendre soin de soi",
      },
    ],
    passages: [],
    discarded: [],
  };
}

function createDeepseekProvider() {
  async function chat(systemPrompt: string, userContent: unknown): Promise<unknown> {
    const base = env.deepseekBaseUrl.replace(/\/+$/, "");
    const response = await fetch(`${base}/chat/completions`, {
      signal: AbortSignal.timeout(60_000),
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
    extract(input: ExtractInput) {
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
  };
}

export function getLlmProvider() {
  if (env.llmProvider === "deepseek" && env.deepseekApiKey) {
    return withLlmTracking(createDeepseekProvider(), { provider: "deepseek", model: env.deepseekModel });
  }
  return withLlmTracking(
    {
      async extract(input: ExtractInput) {
        return mockExtraction(input);
      },
    },
    { provider: "mock", model: "mock" },
  );
}
