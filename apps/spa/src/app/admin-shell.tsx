import { useEffect } from "react";
import { Link, NavLink, Outlet, ScrollRestoration } from "react-router";
import {
  Activity,
  ArrowLeft,
  Bot,
  CreditCard,
  FileText,
  Gift,
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  Workflow,
} from "lucide-react";
import { cn } from "@tmr/ui/utils";
import { goToSignIn, useSession } from "@/lib/session";
import { FullPageSpinner } from "./shell";

const NAV = [
  { to: "/admin", label: "总览", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "用户", icon: Users },
  { to: "/admin/uploads", label: "笔记上传", icon: FileText },
  { to: "/admin/jobs", label: "任务队列", icon: Workflow },
  { to: "/admin/llm", label: "LLM 用量", icon: Bot },
  { to: "/admin/billing", label: "订阅收入", icon: CreditCard },
  { to: "/admin/emails", label: "邮件", icon: Mail },
  { to: "/admin/referrals", label: "推荐", icon: Gift },
  { to: "/admin/settings", label: "设置", icon: Settings },
  { to: "/admin/audit", label: "操作日志", icon: ScrollText },
];

function NavItems({ compact }: { compact?: boolean }) {
  return NAV.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          compact && "text-xs",
        )
      }
    >
      <item.icon className="size-4" />
      {item.label}
    </NavLink>
  ));
}

/** Frame for /admin: side navigation on wide screens, a scrolling tab row on phones. */
export function AdminShell() {
  const { data: session, isPending } = useSession();
  const mustSignIn = !isPending && (!session || session.isGuest);

  useEffect(() => {
    if (mustSignIn) {
      goToSignIn();
    }
  }, [mustSignIn]);

  if (isPending || mustSignIn) {
    return <FullPageSpinner />;
  }
  if (!session?.isAdmin) {
    return (
      <main className="mx-auto grid max-w-md flex-1 place-items-center px-4 py-24 text-center">
        <div className="space-y-3">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
          <h1 className="font-heading text-xl font-semibold">没有管理员权限</h1>
          <p className="text-sm text-muted-foreground">
            当前账号 {session?.user.email} 不在 ADMIN_EMAILS 名单里，或邮箱还没有验证。
          </p>
          <Link to="/classrooms" className="text-sm text-primary hover:underline">
            回到课堂
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-svh flex-1 flex-col md:flex-row">
      <aside className="hidden w-52 shrink-0 border-r border-border/70 bg-card/40 md:block">
        <div className="sticky top-0 flex h-svh flex-col gap-1 p-3">
          <div className="flex items-center gap-2 px-2.5 pb-3 pt-1">
            <Activity className="size-4 text-primary" />
            <span className="font-heading text-sm font-semibold">后台管理</span>
          </div>
          <NavItems />
          <Link
            to="/classrooms"
            className="mt-auto flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            回到应用
          </Link>
        </div>
      </aside>
      <nav className="sticky top-0 z-30 flex gap-1 overflow-x-auto border-b border-border/70 bg-background/90 px-4 py-2 backdrop-blur md:hidden">
        <NavItems compact />
      </nav>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
      <ScrollRestoration />
    </div>
  );
}
