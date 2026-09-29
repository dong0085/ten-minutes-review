import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { ZodError, type ZodType } from "zod";
import type { MessagesShape } from "@tmr/core";

type ApiMessageKey = keyof MessagesShape["Api"];

const MESSAGE_KEYS: Record<string, ApiMessageKey> = {
  Unauthorized: "unauthorized",
  "Not found": "notFound",
  "Email already registered": "emailRegistered",
  "Invalid or missing token": "invalidToken",
  "Invalid or expired token": "invalidExpiredToken",
  "Add notes to create a quiz": "emptyBank",
  "Exams are a Pro feature": "examProRequired",
  "Add more notes to unlock the exam": "examLocked",
  "Corrections are a Pro feature": "mistakeBookProRequired",
  "No more hints for this question": "tutorLimit",
  "Could not ask the tutor": "tutorFailed",
  "Attempt token is invalid or expired": "attemptInvalid",
  "This attempt was already submitted": "attemptSubmitted",
  "Could not record the attempt": "attemptRecord",
  "Billing is not available right now": "billingUnavailable",
  "You already have an active subscription": "alreadySubscribed",
  "Invalid form data": "invalidFormData",
  "Attach between 1 and 10 images": "imageCount",
  "Invalid date": "invalidDate",
  "Invalid timezone": "invalidTimezone",
  "Current password is incorrect": "passwordIncorrect",
  "Set a password before unlinking Google": "unlinkWithoutPassword",
};

const TOO_LARGE = /^(.+) is larger than 10MB$/;
// Limits the admin console can change carry their number in the message.
const COUNTED: [RegExp, ApiMessageKey][] = [
  [/^Free plan is limited to (\d+) classrooms$/, "freePlanLimit"],
  [/^Upload limit reached: (\d+) uploads per day$/, "uploadLimit"],
  [/^Free plan is limited to (\d+) notes uploads per month$/, "freeUploadLimit"],
];
const WRONG_TYPE = /^(.+) must be a JPEG, PNG, WebP, GIF, AVIF, or HEIC image$/;

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

async function localizeMessage(message: string): Promise<string> {
  const t = await getTranslations("Api");
  const key = MESSAGE_KEYS[message];
  if (key) {
    return t(key);
  }
  for (const [pattern, countedKey] of COUNTED) {
    const counted = pattern.exec(message);
    if (counted) {
      return t(countedKey, { count: Number(counted[1]) });
    }
  }
  const tooLarge = TOO_LARGE.exec(message);
  if (tooLarge) {
    return t("fileTooLarge", { name: tooLarge[1] ?? "" });
  }
  const wrongType = WRONG_TYPE.exec(message);
  if (wrongType) {
    return t("fileWrongType", { name: wrongType[1] ?? "" });
  }
  return message;
}

export async function jsonError(message: string, status = 400, code?: string) {
  const localized = await localizeMessage(message);
  return NextResponse.json(code ? { error: localized, code } : { error: localized }, { status });
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body = await request.json().catch(() => null);
  return schema.parse(body);
}

export async function handleRouteError(error: unknown) {
  const t = await getTranslations("Api");
  if (error instanceof ZodError) {
    return jsonError(t("invalidRequest"), 422);
  }
  console.error(error);
  return jsonError(t("generic"), 500);
}
