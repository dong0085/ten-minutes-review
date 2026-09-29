// Client for TypeSafe's Jev, a decision model that answers typed questions with
// probabilities instead of text. https://docs.typesafe.ai/api
import { env } from "./env";

export type JevQuestion =
  | {
      type: "noul";
      instructions: unknown;
      criteria: { true: unknown; false: unknown };
    }
  | {
      type: "choice";
      instructions: unknown;
      criteria: Record<string, unknown>;
    }
  | {
      type: "score";
      instructions: unknown;
      criteria: unknown[];
    };

export type JevAnswer = {
  type: "noul" | "choice" | "score";
  noul?: number;
  choice?: string;
  score?: number;
  probabilities?: Record<string, number>;
  legend?: Record<string, string>;
  confidence?: number;
};

export type JevClient = {
  ask(state: unknown, questions: Record<string, JevQuestion>): Promise<Record<string, JevAnswer>>;
};

const RETRYABLE = new Set([429, 529]);
const ATTEMPTS = 4;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createJevClient(): JevClient {
  if (!env.jevApiKey) {
    throw new Error("JEV_API_KEY is required when JUDGE_PROVIDER=jev");
  }
  const url = `${env.jevBaseUrl.replace(/\/+$/, "")}/v1/systemone`;
  return {
    async ask(state, questions) {
      for (let attempt = 1; ; attempt += 1) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30_000),
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.jevApiKey}`,
          },
          body: JSON.stringify({ model: env.jevModel, state, questions }),
        });
        if (RETRYABLE.has(response.status) && attempt < ATTEMPTS) {
          await wait(500 * 2 ** attempt);
          continue;
        }
        if (!response.ok) {
          throw new Error(`Jev request failed (${response.status}): ${await response.text()}`);
        }
        const data = (await response.json()) as { answers?: Record<string, JevAnswer> };
        if (!data.answers) {
          throw new Error("Jev response is missing answers");
        }
        return data.answers;
      }
    },
  };
}
