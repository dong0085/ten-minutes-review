import path from "node:path";
import dotenv from "dotenv";
import { normalizeAppUrl } from "@tmr/core";

dotenv.config({ path: [path.resolve(process.cwd(), "../../.env"), ".env"] });

function provider<T extends string>(
  value: string | undefined,
  fallback: T,
  allowed: readonly T[],
): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export type LlmProviderName = "mock" | "deepseek";
export type EmailProviderName = "console" | "resend" | "brevo";
export type StorageProviderName = "local" | "vercel" | "s3";

export const env = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get authSecret(): string {
    return required("AUTH_SECRET");
  },
  appUrl: normalizeAppUrl(process.env.APP_URL ?? "http://localhost:3000"),
  port: Number(process.env.PORT ?? 3000),
  llmProvider: provider(process.env.LLM_PROVIDER, "mock", ["mock", "deepseek"] as const),
  emailProvider: provider(process.env.EMAIL_PROVIDER, "console", [
    "console",
    "resend",
    "brevo",
  ] as const),
  storageProvider: provider(process.env.STORAGE_PROVIDER, "local", [
    "local",
    "vercel",
    "s3",
  ] as const),
  emailFrom: process.env.EMAIL_FROM ?? "Ten Minutes Review <onboarding@resend.dev>",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
};

export type Env = typeof env;
