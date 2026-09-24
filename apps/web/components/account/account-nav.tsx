"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, KeyRound, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// Notebook divider tabs: vertical on wide screens, a scrolling strip on phones.
export function AccountNav() {
  const t = useTranslations("Account.Nav");
  const pathname = usePathname();
  const tabs = [
    { label: t("overview"), href: "/account", icon: LayoutDashboard },
    { label: t("profile"), href: "/account/profile", icon: UserRound },
    { label: t("security"), href: "/account/security", icon: ShieldCheck },
    { label: t("apiTokens"), href: "/account/api-tokens", icon: KeyRound },
    { label: t("data"), href: "/account/data", icon: Archive },
  ];

  return (
    <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
      {tabs.map((tab) => {
        const active =
          tab.href === "/account" ? pathname === "/account" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative inline-flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
              "lg:rounded-l-md lg:rounded-r-xl",
              active
                ? "border-border/80 bg-card text-foreground shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.05),0_6px_18px_rgb(var(--shadow-colour)/0.06)] lg:translate-x-1.5"
                : "border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground lg:hover:translate-x-0.5",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-2 left-0 hidden w-[3px] rounded-full transition-colors lg:block",
                active ? "bg-primary" : "bg-transparent group-hover:bg-border",
              )}
            />
            <Icon
              className={cn(
                "size-4 transition-transform duration-200 group-hover:-rotate-6",
                active ? "text-primary" : "",
              )}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
