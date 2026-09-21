import { normalizeAppUrl } from "@tmr/core";

const provider = <T extends string>(
  value: string | undefined,
  fallback: T,
  allowed: readonly T[],
): T => (value && allowed.includes(value as T) ? (value as T) : fallback);

export const env = {
  appUrl: normalizeAppUrl(process.env.APP_URL ?? "http://localhost:3000"),
  authSecret: process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "",
  inviteOnly: process.env.INVITE_ONLY !== "false",
  inviteCode: process.env.INVITE_CODE ?? null,
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
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
};
