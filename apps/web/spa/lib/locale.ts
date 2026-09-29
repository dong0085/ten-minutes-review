import { DEFAULT_LOCALE, DEFAULT_THEME, isUiLocale, isUiTheme, type UiLocale, type UiTheme } from "@tmr/core";

export const UI_LOCALE_COOKIE = "NEXT_LOCALE";
export const UI_THEME_COOKIE = "UI_THEME";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1] as string) : null;
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function normalize(value: string | null | undefined): UiLocale | null {
  const base = (value ?? "").trim().toLowerCase().split("-")[0] ?? "";
  return isUiLocale(base) ? base : null;
}

/** Same order as the server: profile, then cookie, then the browser. */
export function resolveLocale(uiLanguage: string | null | undefined): UiLocale {
  return (
    normalize(uiLanguage) ??
    normalize(readCookie(UI_LOCALE_COOKIE)) ??
    navigator.languages.map(normalize).find((locale) => locale !== null) ??
    DEFAULT_LOCALE
  );
}

/** The account's saved palette wins, then the cookie, then the default. */
export function resolveTheme(accountTheme: string | null | undefined): UiTheme {
  const candidates = [accountTheme, readCookie(UI_THEME_COOKIE)];
  for (const value of candidates) {
    const normalized = value?.trim().toLowerCase();
    if (normalized && isUiTheme(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_THEME;
}
