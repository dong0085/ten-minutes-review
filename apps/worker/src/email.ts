import { Resend } from "resend";
import { env } from "./env";

export {
  renderActionEmail,
  renderDailyQuizEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
} from "@tmr/email";
export type { DailyQuizEmailEntry } from "@tmr/email";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function parseSender(value: string): { name?: string; email: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match?.[2]) {
    return match[1] ? { name: match[1], email: match[2] } : { email: match[2] };
  }
  return { email: value.trim() };
}

async function sendViaBrevo(
  apiKey: string,
  from: string,
  message: EmailMessage,
): Promise<{ id: string | null }> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    signal: AbortSignal.timeout(30_000),
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(from),
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Brevo send failed (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { messageId?: string };
  return { id: data.messageId ?? null };
}

export async function sendEmail(message: EmailMessage): Promise<{ id: string | null }> {
  if (env.emailProvider === "resend") {
    if (!env.resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    const resend = new Resend(env.resendApiKey);
    const { data, error } = await resend.emails.send({
      from: env.emailFrom,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      throw new Error(error.message);
    }
    return { id: data?.id ?? null };
  }

  if (env.emailProvider === "brevo") {
    if (!env.brevoApiKey) {
      throw new Error("BREVO_API_KEY is not set");
    }
    return sendViaBrevo(env.brevoApiKey, env.emailFrom, message);
  }

  console.log(
    `\n[email:console] to=${message.to}\nsubject=${message.subject}\n\n${message.text}\n`,
  );
  return { id: null };
}
