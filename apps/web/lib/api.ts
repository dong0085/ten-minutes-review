import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { ZodError, type ZodType } from "zod";
import type { MessagesShape } from "@tmr/core";

type ApiMessageKey = keyof MessagesShape["Api"];

const MESSAGE_KEYS: Record<string, ApiMessageKey> = {
  Unauthorized: "unauthorized",
  "Not found": "notFound",
  "Email already registered": "emailRegistered",
  "Invite code required": "inviteRequired",
  "Invalid or missing token": "invalidToken",
  "Invalid or expired token": "invalidExpiredToken",
  "Free plan is limited to 3 classrooms": "freePlanLimit",
  "Add notes to create a quiz": "emptyBank",
  "Attempt token is invalid or expired": "attemptInvalid",
  "This attempt was already submitted": "attemptSubmitted",
  "Could not record the attempt": "attemptRecord",
  "Upload limit reached: 50 uploads per day": "uploadLimit",
  "Free plan is limited to 2 notes uploads per month": "freeUploadLimit",
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
