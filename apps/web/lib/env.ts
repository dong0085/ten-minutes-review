import { normalizeAppUrl } from "@tmr/core";

const provider = <T extends string>(
  value: string | undefined,
  fallback: T,
  allowed: readonly T[],
): T => (value && allowed.includes(value as T) ? (value as T) : fallback);

// `STRIPE_MODE=sandbox` swaps in the `STRIPE_SANDBOX_*` keys for local testing.
// Vercel production always uses the live keys.
const stripeSandbox =
  process.env.STRIPE_MODE === "sandbox" && process.env.VERCEL_ENV !== "production";
const stripeVar = (name: string) =>
  process.env[stripeSandbox ? `STRIPE_SANDBOX_${name}` : `STRIPE_${name}`] ?? "";

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
  stripeSecretKey: stripeVar("SECRET_KEY"),
  stripeWebhookSecret: stripeVar("WEBHOOK_SECRET"),
  stripePriceId: stripeVar("PRICE_ID"),
  // `TEAMID.bundle.id` entries, comma-separated, for iOS password autofill.
  appleAppIds: (process.env.APPLE_APP_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  billingEnabled:
    process.env.BILLING_ENABLED === "true" || process.env.NODE_ENV !== "production",
};
