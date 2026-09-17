import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AccountNav } from "@/components/account/account-nav";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations("Account");
  const format = await getFormatter();

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              {(user.username ?? user.email).slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.username ?? user.email}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("memberSince", {
                date: format.dateTime(user.createdAt, { month: "long", year: "numeric" }),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{t("free")}</Badge>
          {user.username ? <span className="break-all text-xs">{user.email}</span> : null}
        </div>
        <AccountNav />
      </aside>
      <div className="mt-6 min-w-0 lg:mt-0">{children}</div>
    </div>
  );
}
