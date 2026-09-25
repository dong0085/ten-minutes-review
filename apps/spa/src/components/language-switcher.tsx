
import { useState, useTransition, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useRouter } from "@/lib/router";
import { UI_LOCALES } from "@tmr/core";
import { languageLabel } from "@/lib/language-label";
import { UI_LOCALE_COOKIE } from "@/lib/locale";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function LanguageSwitcher({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("Layout");
  const locale = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (next === locale) {
      return;
    }
    setSaving(true);
    try {
      if (signedIn) {
        const response = await fetch("/api/me", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ uiLanguage: next }),
        });
        if (!response.ok) {
          return;
        }
      } else {
        document.cookie = `${UI_LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
      }
      // Signed-out visitors only have the cookie, which is read on boot.
      if (signedIn) {
        startTransition(() => router.refresh());
      } else {
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      aria-label={t("language")}
      className="h-8 rounded-[0.65rem] border border-input/80 bg-card/60 px-2.5 text-xs font-medium text-muted-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/25 disabled:opacity-50 dark:bg-input/20"
      value={locale}
      onChange={handleChange}
      disabled={saving || pending}
    >
      {UI_LOCALES.map((code) => (
        <option key={code} value={code}>
          {languageLabel(code, locale)}
        </option>
      ))}
    </select>
  );
}
