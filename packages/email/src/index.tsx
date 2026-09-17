import { render, toPlainText } from "react-email";
import React from "react";
import type { ReactElement } from "react";
import type { UiLocale } from "@tmr/core";
import { getMessages } from "@tmr/core";
import {
  ActionEmailTemplate,
  DailyQuizEmailTemplate,
  dailyQuizEmailCopy,
} from "./templates";
import type {
  ActionEmailTemplateProps,
  DailyQuizEmailEntry,
  DailyQuizEmailTemplateProps,
} from "./templates";

export type { DailyQuizEmailEntry } from "./templates";

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

async function renderTemplate(element: ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(element);
  return { html, text: toPlainText(html) };
}

export async function renderActionEmail(
  input: ActionEmailTemplateProps,
): Promise<{ html: string; text: string }> {
  return renderTemplate(<ActionEmailTemplate {...input} />);
}

export async function renderVerificationEmail(
  link: string,
  locale: UiLocale,
): Promise<EmailContent> {
  const messages = getMessages(locale).Email;
  const rendered = await renderActionEmail({
    locale,
    heading: messages.verificationSubject,
    body: messages.verificationBody,
    actionLabel: messages.verificationAction,
    actionUrl: link,
  });
  return { subject: messages.verificationSubject, ...rendered };
}

export async function renderPasswordResetEmail(
  link: string,
  locale: UiLocale,
): Promise<EmailContent> {
  const messages = getMessages(locale).Email;
  const rendered = await renderActionEmail({
    locale,
    heading: messages.resetSubject,
    body: messages.resetBody,
    actionLabel: messages.resetAction,
    actionUrl: link,
  });
  return { subject: messages.resetSubject, ...rendered };
}

export async function renderDailyQuizEmail(
  input: DailyQuizEmailTemplateProps,
): Promise<EmailContent> {
  const { subject } = dailyQuizEmailCopy(input);
  const rendered = await renderTemplate(<DailyQuizEmailTemplate {...input} />);
  return { subject, ...rendered };
}

export type { ActionEmailTemplateProps, DailyQuizEmailTemplateProps };
