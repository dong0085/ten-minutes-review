
import { useSyncExternalStore, useState, useTransition } from "react";
import { useRouter } from "@/lib/router";
import { useTranslations } from "use-intl";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { THEME_SWATCHES, UI_THEMES, type UiTheme } from "@tmr/core";
import { Button } from "@tmr/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tmr/ui/components/dropdown-menu";
import { UI_THEME_COOKIE } from "@/lib/locale";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const modeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

/**
 * Keeps the palette and next-themes mode independent. Palette changes update
 * the current page immediately and save to the account when signed in, so the
 * choice follows the learner to other devices; the cookie keeps it for guests
 * and after sign-out. Mode changes are handled by the provider and persist
 * through its own local storage key.
 */
export function ThemeSwitcher({
  currentTheme,
  signedIn,
}: {
  currentTheme: UiTheme;
  signedIn: boolean;
}) {
  const t = useTranslations("Layout");
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [picked, setPicked] = useState<UiTheme | null>(null);
  const [pending, startTransition] = useTransition();
  const activeTheme = picked ?? currentTheme;

  const pick = async (nextTheme: UiTheme) => {
    // These browser APIs provide immediate persistence and avoid a palette flash.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${UI_THEME_COOKIE}=${nextTheme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    // eslint-disable-next-line react-hooks/immutability
    document.documentElement.dataset.theme = nextTheme;
    setPicked(nextTheme);
    if (signedIn) {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uiTheme: nextTheme }),
      }).catch(() => null);
    }
    startTransition(() => router.refresh());
  };

  const pickMode = (mode: string) => {
    setTheme(mode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("theme")}
          disabled={pending}
        >
          <Palette />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("themePalette")}</DropdownMenuLabel>
        {UI_THEMES.map((nextTheme) => (
          <DropdownMenuItem
            key={nextTheme}
            onSelect={() => pick(nextTheme)}
            className="gap-2"
          >
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-full ring-1 ring-foreground/15"
              style={{ backgroundColor: THEME_SWATCHES[nextTheme] }}
            />
            <span className="flex-1">{t(`themeName.${nextTheme}`)}</span>
            {nextTheme === activeTheme ? <Check className="size-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("appearance")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mounted ? theme : undefined}
          onValueChange={pickMode}
        >
          {(["light", "dark", "system"] as const).map((mode) => {
            const Icon = modeIcons[mode];
            return (
              <DropdownMenuRadioItem key={mode} value={mode} className="gap-2">
                <Icon className="size-3.5" />
                {t(`mode.${mode}`)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
