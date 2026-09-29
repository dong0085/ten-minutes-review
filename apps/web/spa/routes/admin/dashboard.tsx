import { Link } from "react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { fmt, useAdminQuery } from "@/spa/lib/admin";
import {
  AdminPage,
  DailyBars,
  LoadError,
  Loading,
  Panel,
  StatGrid,
  StatTile,
} from "@/spa/components/admin/ui";

type Overview = {
  users: { total: number; guests: number; disabled: number; new7d: number; new30d: number };
  active: { d1: number; d7: number; d30: number };
  paid: { stripe: number; comp: number; cancelling: number; new30d: number; churned30d: number };
  content: { classrooms: number; uploads7d: number; quizzes7d: number; attempts7d: number };
  llm: { calls7d: number; failed7d: number };
  alerts: {
    failedJobs24h: number;
    stuckJobs: number;
    pendingJobs: number;
    failedExtractions24h: number;
    lastJobFinishedAt: string | null;
  };
  mrrUsd: number;
  llmCost30dUsd: number;
  series: {
    day: string;
    signups: number;
    activeUsers: number;
    uploads: number;
    quizzes: number;
    attempts: number;
    llmCostUsd: number;
  }[];
};

const WORKER_QUIET_MINUTES = 30;

function Alerts({ data, now }: { data: Overview; now: number }) {
  const { alerts } = data;
  const quietFor = alerts.lastJobFinishedAt
    ? (now - new Date(alerts.lastJobFinishedAt).getTime()) / 60000
    : Infinity;
  const items = [
    alerts.failedJobs24h > 0 && { text: `24 小时内有 ${alerts.failedJobs24h} 个任务失败`, to: "/admin/jobs?status=failed" },
    alerts.stuckJobs > 0 && { text: `${alerts.stuckJobs} 个任务卡住超过 10 分钟`, to: "/admin/jobs?status=stuck" },
    alerts.failedExtractions24h > 0 && {
      text: `24 小时内有 ${alerts.failedExtractions24h} 次笔记提取失败`,
      to: "/admin/uploads?status=failed",
    },
    alerts.pendingJobs > 20 && { text: `${alerts.pendingJobs} 个任务在排队`, to: "/admin/jobs?status=pending" },
    alerts.pendingJobs > 0 &&
      quietFor > WORKER_QUIET_MINUTES && {
        text: `有任务在排队，但 worker 已经 ${fmt.ago(alerts.lastJobFinishedAt)} 没完成过任务`,
        to: "/admin/jobs?status=pending",
      },
    data.llm.calls7d > 0 &&
      data.llm.failed7d / data.llm.calls7d > 0.05 && {
        text: `近 7 天 LLM 失败率 ${Math.round((data.llm.failed7d / data.llm.calls7d) * 100)}%`,
        to: "/admin/llm",
      },
  ].filter(Boolean) as { text: string; to: string }[];

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="size-4" />
        一切正常。worker 最近一次完成任务：{fmt.ago(alerts.lastJobFinishedAt)}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.text}>
          <Link
            to={item.to}
            className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning hover:bg-warning/10"
          >
            <AlertTriangle className="size-4 shrink-0" />
            {item.text}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AdminDashboardPage() {
  const { data, error, isPending, dataUpdatedAt } = useAdminQuery<Overview>("/overview", {
    refetchInterval: 60_000,
  });
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const series = (key: keyof Overview["series"][number]) =>
    data.series.map((day) => ({ day: day.day, value: Number(day[key]) }));

  return (
    <AdminPage title="总览" description="每分钟自动刷新。日期按 UTC 计算。">
      <Alerts data={data} now={dataUpdatedAt} />
      <StatGrid>
        <StatTile label="注册用户" value={fmt.n(data.users.total)} hint={`近 7 天 +${data.users.new7d} · 近 30 天 +${data.users.new30d}`} to="/admin/users" />
        <StatTile label="活跃用户（答过题）" value={fmt.n(data.active.d7)} hint={`今天 ${data.active.d1} · 30 天 ${data.active.d30}`} />
        <StatTile
          label="付费用户"
          value={fmt.n(data.paid.stripe)}
          hint={`赠送 ${data.paid.comp} · 将取消 ${data.paid.cancelling}`}
          to="/admin/billing"
        />
        <StatTile label="MRR" value={fmt.usd(data.mrrUsd)} hint={`30 天新增 ${data.paid.new30d} · 流失 ${data.paid.churned30d}`} to="/admin/billing" />
        <StatTile label="LLM 成本（30 天）" value={fmt.usd(data.llmCost30dUsd)} hint={`7 天 ${fmt.n(data.llm.calls7d)} 次调用`} to="/admin/llm" />
        <StatTile label="课堂" value={fmt.n(data.content.classrooms)} hint={`访客 ${data.users.guests} · 封禁 ${data.users.disabled}`} />
        <StatTile label="近 7 天上传" value={fmt.n(data.content.uploads7d)} to="/admin/uploads" />
        <StatTile label="近 7 天答题" value={fmt.n(data.content.attempts7d)} hint={`生成测验 ${data.content.quizzes7d}`} />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="每日注册">
          <DailyBars data={series("signups")} format={fmt.n} />
        </Panel>
        <Panel title="每日活跃用户">
          <DailyBars data={series("activeUsers")} format={fmt.n} />
        </Panel>
        <Panel title="每日笔记上传">
          <DailyBars data={series("uploads")} format={fmt.n} />
        </Panel>
        <Panel title="每日答题次数">
          <DailyBars data={series("attempts")} format={fmt.n} />
        </Panel>
        <Panel title="每日生成测验">
          <DailyBars data={series("quizzes")} format={fmt.n} />
        </Panel>
        <Panel title="每日 LLM 成本">
          <DailyBars data={series("llmCostUsd")} format={fmt.usd} />
        </Panel>
      </div>
    </AdminPage>
  );
}
