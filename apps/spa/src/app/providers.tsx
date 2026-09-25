import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { IntlProvider } from "use-intl";
import { getMessages } from "@tmr/core";
import { Toaster } from "@tmr/ui/components/sonner";
import { ApiError } from "@/lib/api";
import { resolveLocale, resolveTheme } from "@/lib/locale";
import { useSession } from "@/lib/session";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: (count, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

function IntlFromSession({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const locale = resolveLocale(session?.user.uiLanguage);
  const theme = resolveTheme(session?.user.uiTheme);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);

  return (
    <IntlProvider
      locale={locale}
      messages={getMessages(locale)}
      timeZone={session?.user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
    >
      {children}
    </IntlProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <IntlFromSession>
          {children}
          <Toaster />
        </IntlFromSession>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
