import { useEffect, type ReactNode } from "react";
import { Link, Outlet, ScrollRestoration, useLocation } from "react-router";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@tmr/ui/components/avatar";
import { Button } from "@tmr/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tmr/ui/components/dropdown-menu";
import { BrandMark } from "@/components/brand-mark";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { resolveTheme } from "@/lib/locale";
import { goToSignIn, signOut, useSession } from "@/lib/session";

/** Screens an anonymous visitor may open; everything else needs a session. */
const PUBLIC_PATHS = new Set(["/classrooms", "/classrooms/new"]);

function TopBar() {
  const t = useTranslations("Layout");
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const signedIn = Boolean(session && !session.isGuest);
  const theme = resolveTheme(user?.uiTheme);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
        <BrandMark />
        <Breadcrumbs />
        <div className="ml-auto flex shrink-0 items-center gap-1.5 text-sm sm:gap-2">
          <span className="hidden sm:contents">
            <LanguageSwitcher signedIn={signedIn} />
          </span>
          <ThemeSwitcher currentTheme={theme} signedIn={signedIn} />
          {user && signedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label={user.username ?? user.email}>
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
                  <Link to="/classrooms">{t("classrooms")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account">{t("account")}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>{t("signOut")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <a
                className="hidden text-muted-foreground hover:text-foreground sm:inline"
                href="/signin"
              >
                {t("signIn")}
              </a>
              <Button asChild size="sm">
                <a href="/signup">{t("createAccount")}</a>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function FullPageSpinner() {
  const t = useTranslations("Common");
  return (
    <div className="grid flex-1 place-items-center py-24" role="status">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}

/** Holds the screen until the session is known, and sends signed-out visitors to sign in. */
function SessionGate({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const { pathname } = useLocation();
  const needsSession = !PUBLIC_PATHS.has(pathname.replace(/\/+$/, ""));
  // Guests have classrooms but no account to manage.
  const needsAccount = pathname.startsWith("/account");
  const mustSignIn =
    !isPending &&
    ((session === null && needsSession) || (needsAccount && session?.isGuest === true));

  useEffect(() => {
    if (mustSignIn) {
      goToSignIn();
    }
  }, [mustSignIn]);

  if (isPending || mustSignIn) {
    return <FullPageSpinner />;
  }
  return children;
}

/** The standard frame: top bar with breadcrumbs above one focused screen. */
export function AppShell() {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <SessionGate>
          <Outlet />
        </SessionGate>
      </main>
      <ScrollRestoration />
    </>
  );
}

/** No top bar: the quiz runner takes the whole screen. */
export function FocusShell() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <SessionGate>
        <Outlet />
      </SessionGate>
      <ScrollRestoration />
    </main>
  );
}
