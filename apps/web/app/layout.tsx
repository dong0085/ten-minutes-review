import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import "@tmr/ui/globals.css";
import { env } from "@/lib/env";
import { getLayoutUser } from "@/lib/layout-user";
import { SITE_NAME } from "@/lib/seo";
import { getTheme } from "@/lib/theme-server";
import { Caveat, Geist, Source_Serif_4 } from "next/font/google";
import { cn } from "@tmr/ui/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
});
// Handwriting for the classroom hub's mailbox and its date.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwriting",
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
    applicationName: SITE_NAME,
    openGraph: { siteName: SITE_NAME, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const current = await getLayoutUser();
  const signedIn = Boolean(current && !current.isGuest);
  const locale = await getLocale();
  const theme = await getTheme(signedIn ? current?.user.uiTheme : null);
  return (
    <html
      lang={locale}
      data-theme={theme}
      className={cn(
        "font-sans",
        geist.variable,
        sourceSerif.variable,
        caveat.variable,
      )}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
