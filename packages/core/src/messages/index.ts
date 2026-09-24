import { en } from "./en";
import { fr } from "./fr";
import { zh } from "./zh";
import type { MessageShape } from "./type";

export const UI_LOCALES = ["en", "fr", "zh"] as const;

export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_LOCALE: UiLocale = "en";

export type Messages = typeof en;

export type MessagesShape = MessageShape<Messages>;

const catalogs: Record<UiLocale, MessagesShape> = { en, fr, zh };

export function isUiLocale(value: string): value is UiLocale {
  return UI_LOCALES.some((locale) => locale === value);
}

export function toUiLocale(value: string | null | undefined): UiLocale {
  if (!value) {
    return DEFAULT_LOCALE;
  }
  const base = value.trim().toLowerCase().split("-")[0] ?? "";
  return isUiLocale(base) ? base : DEFAULT_LOCALE;
}

export function getMessages(locale: UiLocale): MessagesShape {
  return catalogs[locale];
}

export function formatMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
