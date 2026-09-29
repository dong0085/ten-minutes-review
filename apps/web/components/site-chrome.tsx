import type { ReactNode } from "react";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Button } from "@tmr/ui/components/button";
import { Toaster } from "@tmr/ui/components/sonner";
import {
  Avatar,
  AvatarFallback,
} from "@tmr/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tmr/ui/components/dropdown-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandMark } from "@/components/brand-mark";
import { signOut } from "@/lib/auth";
import { getLayoutUser } from "@/lib/layout-user";
import { getTheme } from "@/lib/theme-server";

/** The header, providers, and toaster around every server-rendered page. */
export async function SiteChrome({ children }: { children: ReactNode }) {
  const current = await getLayoutUser();
  const user = current?.user ?? null;
  const isGuest = current?.isGuest ?? false;
  const signedIn = Boolean(user && !isGuest);
  const theme = await getTheme(signedIn ? user?.uiTheme : null);
  const t = await getTranslations("Layout");
  return (
    <ThemeProvider>
      <NextIntlClientProvider>
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <BrandMark />
            <div className="flex items-center gap-2 text-sm">
              {user ? (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <a href="/classrooms">{t("classrooms")}</a>
                </Button>
              ) : null}
              <LanguageSwitcher signedIn={signedIn} />
              <ThemeSwitcher currentTheme={theme} signedIn={signedIn} />
              {user && !isGuest ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={user.username ?? user.email}
                    >
                      <Avatar size="sm">
                        <AvatarFallback>
                          {(user.username ?? user.email).slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {user.username ?? user.email}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/classrooms">{t("classrooms")}</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="/account">{t("account")}</a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <form
                      action={async () => {
                        "use server";
                        await signOut({ redirectTo: "/" });
                      }}
                    >
                      <DropdownMenuItem asChild>
                        <button type="submit" className="w-full text-left">
                          {t("signOut")}
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Link className="hidden text-muted-foreground hover:text-foreground sm:inline" href="/signin">
                    {t("signIn")}
                  </Link>
                  <Button asChild size="sm">
                    <Link href="/signup">{t("createAccount")}</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {children}
        </main>
        <Toaster />
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
