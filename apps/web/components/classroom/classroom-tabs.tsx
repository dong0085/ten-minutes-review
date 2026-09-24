"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, Clock3, Home, Library, Settings2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClassroomTabs({ classroomId }: { classroomId: string }) {
  const t = useTranslations("Classroom.Tabs");
  const pathname = usePathname();
  const base = `/classrooms/${classroomId}`;
  const tabs = [
    { label: t("home"), href: base, icon: Home },
    { label: t("upload"), href: `${base}/upload`, icon: Upload },
    { label: t("history"), href: `${base}/history`, icon: Clock3 },
    { label: t("bank"), href: `${base}/bank`, icon: Library },
    { label: t("quizzes"), href: `${base}/quizzes`, icon: BookOpen },
    { label: t("settings"), href: `${base}/settings`, icon: Settings2 },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto overflow-y-hidden rounded-xl border border-border/70 bg-muted/45 p-1">
      {tabs.map((tab) => {
        const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm",
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
