import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountNav } from "@/components/account/account-nav";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations("Account");

  return (
    <div className="lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-12">
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow hidden lg:block">{t("title")}</p>
        <AccountNav />
        <p className="hidden break-all text-xs leading-5 text-muted-foreground lg:block">
          {t("signedInAs", { email: user.email })}
        </p>
      </aside>
      <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
    </div>
  );
}
