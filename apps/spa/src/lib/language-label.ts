import { languageName } from "@tmr/core";

export function languageLabel(code: string, locale: string): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "language" });
    const label = displayNames.of(code) ?? languageName(code) ?? code;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return languageName(code) ?? code;
  }
}
