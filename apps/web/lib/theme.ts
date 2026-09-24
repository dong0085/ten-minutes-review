import { DEFAULT_THEME, isUiTheme, type UiTheme } from "@tmr/core";

export const UI_THEME_COOKIE = "UI_THEME";

export function normalizeTheme(value: string | null | undefined): UiTheme | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return isUiTheme(normalized) ? normalized : null;
}

/**
 * The account's saved palette wins, so the choice follows the learner across
 * devices. The cookie covers guests and signed-out visitors, and anyone who
 * has not picked a theme gets the default one. The first paint is already in
 * the right palette, so no client-side switching is needed.
 */
export function resolveTheme(
  accountTheme: string | null | undefined,
  cookieTheme: string | null | undefined,
): UiTheme {
  return normalizeTheme(accountTheme) ?? normalizeTheme(cookieTheme) ?? DEFAULT_THEME;
}
