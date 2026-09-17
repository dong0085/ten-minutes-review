"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Database, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountNav() {
  const t = useTranslations("Account.Nav");
  const pathname = usePathname();
  const tabs = [
    { label: t("overview"), href: "/account", icon: LayoutDashboard },
    { label: t("profile"), href: "/account/profile", icon: UserRound },
    { label: t("security"), href: "/account/security", icon: ShieldCheck },
    { label: t("data"), href: "/account/data", icon: Database },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto overflow-y-hidden rounded-xl border border-border/70 bg-muted/45 p-1 lg:flex-col lg:overflow-visible">
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
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm lg:justify-start",
              active
                ? "bg-card text-foreground shadow-[0_1px_3px_rgb(var(--shadow-colour)/0.08)]"
                : "text-muted-foreground hover:bg-card/45 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-3.5", active && "text-primary")} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
