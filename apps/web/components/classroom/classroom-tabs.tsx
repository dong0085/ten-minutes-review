"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, Clock3, Home, Library, Settings2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

// Folder tabs along a rule: the open tab lifts and breaks the line.
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
    <nav className="folder-tabs -mx-4 flex gap-1 overflow-x-auto overflow-y-hidden px-4 pt-2 sm:mx-0 sm:px-1">
      {tabs.map((tab) => {
        const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group inline-flex shrink-0 items-center gap-1.5 rounded-t-xl border border-b-0 px-3.5 text-sm font-medium transition-all duration-200",
              active
                ? "border-border bg-background py-2.5 text-foreground shadow-[0_-3px_10px_rgb(var(--shadow-colour)/0.04)]"
                : "mt-1.5 border-transparent py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 transition-transform duration-200 group-hover:-rotate-6",
                active && "text-primary",
              )}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
