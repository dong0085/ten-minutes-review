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
  storageProvider: provider(process.env.STORAGE_PROVIDER, "local", ["local", "vercel"] as const),
  emailFrom: process.env.EMAIL_FROM ?? "Ten Minutes Review <onboarding@resend.dev>",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  goatcounterUrl: process.env.GOATCOUNTER_URL ?? "",
};
