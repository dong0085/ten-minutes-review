import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandMark } from "@/components/brand-mark";
import { GoatCounterAnalytics } from "@/components/goatcounter-analytics";
import { signOut } from "@/lib/auth";
import { env } from "@/lib/env";
import { getCurrentUserOrGuest } from "@/lib/session";
import { getTheme } from "@/lib/theme-server";
import { Geist, Source_Serif_4 } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
});


export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Layout");
  return {
    metadataBase: new URL(env.appUrl),
    title: {
      default: t("title"),
      template: `%s · ${t("title")}`,
    },
    description: t("description"),
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const current = await getCurrentUserOrGuest();
  const user = current?.user ?? null;
  const isGuest = current?.isGuest ?? false;
  const locale = await getLocale();
  const theme = await getTheme();
  const t = await getTranslations("Layout");
  return (
    <html
      lang={locale}
      data-theme={theme}
      className={cn("font-sans", geist.variable, sourceSerif.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <ThemeProvider>
          <NextIntlClientProvider>
          <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
            <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <BrandMark />
              <div className="flex items-center gap-2 text-sm">
                {user ? (
                  <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link href="/classrooms">{t("classrooms")}</Link>
                  </Button>
                ) : null}
                <LanguageSwitcher signedIn={Boolean(user && !isGuest)} />
                <ThemeSwitcher currentTheme={theme} />
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
                        <Link href="/classrooms">{t("classrooms")}</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/account">{t("account")}</Link>
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
          {env.goatcounterUrl ? (
            <GoatCounterAnalytics endpoint={env.goatcounterUrl} />
          ) : null}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
