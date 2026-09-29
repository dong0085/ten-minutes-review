import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@tmr/ui/components/button";
import {
  JOB_KIND_LABELS,
  JOB_STATUS_LABELS,
  LLM_PURPOSE_LABELS,
  fmt,
  useAdminAction,
  useAdminQuery,
} from "@/lib/admin";
import {
  AdminPage,
  ConfirmButton,
  DailyBars,
  DataTable,
  FilterTabs,
  JsonBlock,
  KeyValues,
  LoadError,
  Loading,
  Pager,
  Panel,
  StatGrid,
  StatTile,
  StatusBadge,
  UserLink,
} from "@/components/admin/ui";

// ---------- Jobs ----------

type Job = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  runAt: string;
  status: string;
  attempts: number;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
};

const JOB_LIMIT = 50;

export function AdminJobsPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") ?? "";
  const status = params.get("status") ?? "";
  const offset = Number(params.get("offset") ?? 0);
  const query = new URLSearchParams({ kind, status, offset: String(offset), limit: String(JOB_LIMIT) });
  const { data, error, isPending } = useAdminQuery<{
    rows: Job[];
    counts: { kind: string; status: string; n: number }[];
  }>(`/jobs?${query}`, { refetchInterval: 15_000 });
  const set = (next: Record<string, string>) =>
    setParams({ kind, status, offset: "0", ...next }, { replace: true });

  const countBy = (field: "kind" | "status", value: string) =>
    (data?.counts ?? []).filter((row) => row[field] === value).reduce((sum, row) => sum + row.n, 0);

  return (
    <AdminPage title="任务队列" description="每 15 秒刷新。计数包含近 7 天的任务和所有未完成的任务。">
      {data ? (
        <StatGrid>
          <StatTile label="排队中" value={countBy("status", "pending")} />
          <StatTile label="运行中" value={countBy("status", "running")} />
          <StatTile label="失败（7 天）" value={countBy("status", "failed")} tone={countBy("status", "failed") ? "destructive" : undefined} />
          <StatTile label="完成（7 天）" value={countBy("status", "done")} />
        </StatGrid>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <FilterTabs
          value={kind}
          onChange={(value) => set({ kind: value })}
          options={[{ value: "", label: "全部类型" }, ...Object.entries(JOB_KIND_LABELS).map(([value, label]) => ({ value, label }))]}
        />
        <FilterTabs
          value={status}
          onChange={(value) => set({ status: value })}
          options={[
            { value: "", label: "全部状态" },
            ...["pending", "running", "stuck", "failed", "done", "cancelled"].map((value) => ({
              value,
              label: JOB_STATUS_LABELS[value],
            })),
          ]}
        />
      </div>
      <Panel flush>
        {isPending ? (
          <Loading />
        ) : error || !data ? (
          <div className="p-4">
            <LoadError error={error} />
          </div>
        ) : (
          <>
            <DataTable
              rows={data.rows}
              rowKey={(row) => row.id}
              columns={[
                {
                  header: "任务",
                  cell: (row) => (
                    <Link to={`/admin/jobs/${row.id}`} className="text-primary hover:underline">
                      {JOB_KIND_LABELS[row.kind] ?? row.kind}
                    </Link>
                  ),
                },
                { header: "状态", cell: (row) => <StatusBadge status={row.status} label={JOB_STATUS_LABELS[row.status]} /> },
                { header: "尝试", cell: (row) => row.attempts, className: "tabular-nums" },
                { header: "创建", cell: (row) => fmt.dateTime(row.createdAt) },
                { header: "结束", cell: (row) => fmt.dateTime(row.finishedAt) },
                {
                  header: "错误",
                  cell: (row) => (
                    <span className="block max-w-xs truncate text-xs text-destructive" title={row.lastError ?? undefined}>
                      {row.lastError ?? ""}
                    </span>
                  ),
                },
              ]}
            />
            <Pager offset={offset} limit={JOB_LIMIT} count={data.rows.length} onChange={(next) => set({ offset: String(next) })} />
          </>
        )}
      </Panel>
    </AdminPage>
  );
}

type LlmCall = {
  id: string;
  purpose: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
  createdAt: string;
};

export function AdminJobPage() {
  const { jobId } = useParams();
  const { data, error, isPending } = useAdminQuery<{ job: Job; llmCalls: LlmCall[] }>(`/jobs/${jobId}`);
  const action = useAdminAction<{ action: "retry" | "cancel" }>(`/jobs/${jobId}`);
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const { job } = data;
  return (
    <AdminPage
      title={JOB_KIND_LABELS[job.kind] ?? job.kind}
      description={<code className="text-xs">{job.id}</code>}
      actions={
        <>
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin/jobs">
              <ArrowLeft className="size-4" /> 任务列表
            </Link>
          </Button>
          {job.status === "pending" ? (
            <ConfirmButton label="取消" title="取消这个任务？" destructive onConfirm={() => action.mutate({ action: "cancel" })} />
          ) : null}
          {["failed", "cancelled", "done"].includes(job.status) ? (
            <ConfirmButton
              label="重试"
              title="重新运行这个任务？"
              description="尝试次数清零，马上排队。完成过的任务重跑可能会重复发邮件或生成内容。"
              onConfirm={() => action.mutate({ action: "retry" })}
            />
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="状态">
          <KeyValues
            items={[
              ["状态", <StatusBadge status={job.status} label={JOB_STATUS_LABELS[job.status]} />],
              ["尝试次数", job.attempts],
              ["创建", fmt.dateTime(job.createdAt)],
              ["计划运行", fmt.dateTime(job.runAt)],
              ["锁定", job.lockedAt ? `${fmt.dateTime(job.lockedAt)} · ${job.lockedBy}` : "—"],
              ["结束", fmt.dateTime(job.finishedAt)],
            ]}
          />
        </Panel>
        <Panel title="Payload">
          <JsonBlock value={job.payload} />
        </Panel>
      </div>
      {job.lastError ? (
        <Panel title="最后一次错误">
          <JsonBlock value={job.lastError} />
        </Panel>
      ) : null}
      <Panel title="LLM 调用" flush>
        <DataTable
          rows={data.llmCalls}
          rowKey={(row) => row.id}
          empty="这个任务没有 LLM 调用记录"
          columns={[
            { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
            { header: "用途", cell: (row) => LLM_PURPOSE_LABELS[row.purpose] ?? row.purpose },
            { header: "模型", cell: (row) => row.model },
            { header: "输入 / 缓存 / 输出", cell: (row) => `${fmt.n(row.inputTokens)} / ${fmt.n(row.cachedInputTokens)} / ${fmt.n(row.outputTokens)}` },
            { header: "耗时", cell: (row) => fmt.ms(row.durationMs) },
            { header: "结果", cell: (row) => (row.ok ? <StatusBadge status="done" label="成功" /> : <span className="text-xs text-destructive">{row.error}</span>) },
          ]}
        />
      </Panel>
    </AdminPage>
  );
}

// ---------- LLM usage ----------

type Usage = {
  calls: number;
  failed: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type LlmUsage = {
  days: number;
  prices: { input: number; cachedInput: number; output: number };
  byDay: (Usage & { day: string; purpose: string })[];
  byPurpose: (Usage & { purpose: string; p50Ms: number; p95Ms: number })[];
  byModel: { provider: string; model: string; calls: number }[];
  topUsers: (Usage & { userId: string | null; email: string | null; paid: boolean })[];
  recentErrors: { id: string; purpose: string; model: string; userId: string | null; jobId: string | null; error: string; createdAt: string }[];
};

function lastDays(days: number) {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - index)));
    return day.toISOString().slice(0, 10);
  });
}

export function AdminLlmPage() {
  const [params, setParams] = useSearchParams();
  const days = Number(params.get("days") ?? 30);
  const { data, error, isPending } = useAdminQuery<LlmUsage>(`/llm?days=${days}`);
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const total = data.byPurpose.reduce(
    (sum, row) => ({
      calls: sum.calls + row.calls,
      failed: sum.failed + row.failed,
      costUsd: sum.costUsd + row.costUsd,
      tokens: sum.tokens + row.inputTokens + row.outputTokens,
      cached: sum.cached + row.cachedInputTokens,
      input: sum.input + row.inputTokens,
    }),
    { calls: 0, failed: 0, costUsd: 0, tokens: 0, cached: 0, input: 0 },
  );
  const perDay = new Map<string, { cost: number; calls: number }>();
  for (const row of data.byDay) {
    const entry = perDay.get(row.day) ?? { cost: 0, calls: 0 };
    entry.cost += row.costUsd;
    entry.calls += row.calls;
    perDay.set(row.day, entry);
  }
  const axis = lastDays(Math.min(days, 90));

  return (
    <AdminPage
      title="LLM 用量"
      description={`价格：输入 $${data.prices.input} · 缓存 $${data.prices.cachedInput} · 输出 $${data.prices.output}（每百万 token，可在设置里改）`}
      actions={
        <FilterTabs
          value={String(days)}
          onChange={(value) => setParams({ days: value }, { replace: true })}
          options={[
            { value: "7", label: "7 天" },
            { value: "30", label: "30 天" },
            { value: "90", label: "90 天" },
          ]}
        />
      }
    >
      <StatGrid>
        <StatTile label="成本" value={fmt.usd(total.costUsd)} hint={`平均每天 ${fmt.usd(total.costUsd / days)}`} />
        <StatTile label="调用次数" value={fmt.n(total.calls)} />
        <StatTile
          label="失败率"
          value={total.calls ? `${((total.failed / total.calls) * 100).toFixed(1)}%` : "—"}
          hint={`${total.failed} 次失败`}
          tone={total.calls && total.failed / total.calls > 0.05 ? "destructive" : undefined}
        />
        <StatTile label="Token" value={fmt.compact(total.tokens)} hint={`缓存命中 ${total.input ? Math.round((total.cached / total.input) * 100) : 0}%`} />
      </StatGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="每日成本">
          <DailyBars data={axis.map((day) => ({ day, value: perDay.get(day)?.cost ?? 0 }))} format={fmt.usd} />
        </Panel>
        <Panel title="每日调用次数">
          <DailyBars data={axis.map((day) => ({ day, value: perDay.get(day)?.calls ?? 0 }))} format={fmt.n} />
        </Panel>
      </div>
      <Panel title="按用途" flush>
        <DataTable
          rows={data.byPurpose}
          rowKey={(row) => row.purpose}
          columns={[
            { header: "用途", cell: (row) => LLM_PURPOSE_LABELS[row.purpose] ?? row.purpose },
            { header: "调用", cell: (row) => fmt.n(row.calls), className: "text-right tabular-nums" },
            { header: "失败", cell: (row) => fmt.n(row.failed), className: "text-right tabular-nums" },
            { header: "输入", cell: (row) => fmt.compact(row.inputTokens), className: "text-right tabular-nums" },
            { header: "输出", cell: (row) => fmt.compact(row.outputTokens), className: "text-right tabular-nums" },
            { header: "p50 / p95", cell: (row) => `${fmt.ms(row.p50Ms)} / ${fmt.ms(row.p95Ms)}`, className: "text-right tabular-nums" },
            { header: "成本", cell: (row) => fmt.usd(row.costUsd), className: "text-right tabular-nums" },
            { header: "每次", cell: (row) => fmt.usd(row.calls ? row.costUsd / row.calls : 0), className: "text-right tabular-nums" },
          ]}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="成本最高的用户" flush>
          <DataTable
            rows={data.topUsers}
            rowKey={(row) => row.userId ?? "none"}
            columns={[
              { header: "用户", cell: (row) => (row.userId ? <UserLink id={row.userId} email={row.email} /> : "未知") },
              { header: "付费", cell: (row) => (row.paid ? "是" : "") },
              { header: "调用", cell: (row) => fmt.n(row.calls), className: "text-right tabular-nums" },
              { header: "成本", cell: (row) => fmt.usd(row.costUsd), className: "text-right tabular-nums" },
            ]}
          />
        </Panel>
        <Panel title="模型" flush>
          <DataTable
            rows={data.byModel}
            rowKey={(row) => `${row.provider}/${row.model}`}
            columns={[
              { header: "服务商", cell: (row) => row.provider },
              { header: "模型", cell: (row) => row.model },
              { header: "调用", cell: (row) => fmt.n(row.calls), className: "text-right tabular-nums" },
            ]}
          />
        </Panel>
      </div>
      <Panel title="最近的失败" flush>
        <DataTable
          rows={data.recentErrors}
          rowKey={(row) => row.id}
          empty="没有失败"
          columns={[
            { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
            { header: "用途", cell: (row) => LLM_PURPOSE_LABELS[row.purpose] ?? row.purpose },
            { header: "用户", cell: (row) => <UserLink id={row.userId} /> },
            {
              header: "任务",
              cell: (row) =>
                row.jobId ? (
                  <Link to={`/admin/jobs/${row.jobId}`} className="text-primary hover:underline">
                    {row.jobId.slice(0, 8)}
                  </Link>
                ) : (
                  "—"
                ),
            },
            { header: "错误", cell: (row) => <span className="block max-w-md truncate text-xs text-destructive" title={row.error}>{row.error}</span> },
          ]}
        />
      </Panel>
    </AdminPage>
  );
}

// ---------- Billing ----------

type SubscriptionRow = {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export function AdminBillingPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "live";
  const { data, error, isPending } = useAdminQuery<{ rows: SubscriptionRow[]; priceUsd: number; stripeDashboard: string }>(
    `/billing?status=${status}`,
  );
  const overview = useAdminQuery<{ paid: { stripe: number; comp: number; cancelling: number; new30d: number; churned30d: number }; mrrUsd: number }>(
    "/overview",
  );
  const paid = overview.data?.paid;

  return (
    <AdminPage title="订阅收入" description="MRR 按 Stripe 活跃订阅数 × 月价估算，没有扣税费和手续费。">
      {paid && overview.data ? (
        <StatGrid>
          <StatTile label="MRR" value={fmt.usd(overview.data.mrrUsd)} hint={`${paid.stripe} 个活跃订阅`} />
          <StatTile label="将在周期末取消" value={paid.cancelling} tone={paid.cancelling ? "warning" : undefined} />
          <StatTile label="30 天新增 / 流失" value={`${paid.new30d} / ${paid.churned30d}`} />
          <StatTile label="赠送 Pro" value={paid.comp} />
        </StatGrid>
      ) : null}
      <FilterTabs
        value={status}
        onChange={(value) => setParams({ status: value }, { replace: true })}
        options={[
          { value: "live", label: "活跃订阅" },
          { value: "comp", label: "赠送" },
          { value: "ended", label: "已结束 / 欠费" },
          { value: "all", label: "全部" },
        ]}
      />
      <Panel flush>
        {isPending ? (
          <Loading />
        ) : error || !data ? (
          <div className="p-4">
            <LoadError error={error} />
          </div>
        ) : (
          <DataTable
            rows={data.rows}
            rowKey={(row) => row.id}
            columns={[
              { header: "用户", cell: (row) => <UserLink id={row.user_id} email={row.email} /> },
              { header: "方案", cell: (row) => row.plan },
              { header: "状态", cell: (row) => <StatusBadge status={row.status} /> },
              { header: "到期", cell: (row) => fmt.date(row.current_period_end) },
              { header: "周期末取消", cell: (row) => (row.cancel_at_period_end ? "是" : "") },
              {
                header: "Stripe",
                cell: (row) =>
                  row.stripe_customer_id ? (
                    <a
                      href={`${data.stripeDashboard}/customers/${row.stripe_customer_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      打开
                    </a>
                  ) : (
                    "—"
                  ),
              },
              { header: "更新", cell: (row) => fmt.dateTime(row.updated_at) },
            ]}
          />
        )}
      </Panel>
    </AdminPage>
  );
}

// ---------- Emails ----------

type EmailStats = {
  byDay: { day: string; kind: string; n: number }[];
  recent: { id: string; sentOn: string; kind: string; providerMessageId: string | null; createdAt: string; userId: string; email: string }[];
  preferences: { subscribed?: number; dailyOff?: number; unsubscribed?: number; unsubscribed30d?: number };
};

export function AdminEmailsPage() {
  const { data, error, isPending } = useAdminQuery<EmailStats>("/emails");
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const perDay = new Map<string, number>();
  for (const row of data.byDay) {
    perDay.set(row.day, (perDay.get(row.day) ?? 0) + row.n);
  }
  const axis = lastDays(30);
  return (
    <AdminPage title="邮件" description="每日测验邮件和考试邮件的发送记录。">
      <StatGrid>
        <StatTile label="订阅每日邮件" value={fmt.n(data.preferences.subscribed)} />
        <StatTile label="关闭每日邮件" value={fmt.n(data.preferences.dailyOff)} />
        <StatTile label="已退订" value={fmt.n(data.preferences.unsubscribed)} hint={`近 30 天 ${data.preferences.unsubscribed30d ?? 0}`} />
        <StatTile label="近 30 天发送" value={fmt.n([...perDay.values()].reduce((a, b) => a + b, 0))} />
      </StatGrid>
      <Panel title="每日发送量">
        <DailyBars data={axis.map((day) => ({ day, value: perDay.get(day) ?? 0 }))} format={fmt.n} />
      </Panel>
      <Panel title="最近发送" flush>
        <DataTable
          rows={data.recent}
          rowKey={(row) => row.id}
          columns={[
            { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
            { header: "用户", cell: (row) => <UserLink id={row.userId} email={row.email} /> },
            { header: "类型", cell: (row) => row.kind },
            { header: "测验日", cell: (row) => row.sentOn },
            { header: "服务商 ID", cell: (row) => <code className="text-xs">{row.providerMessageId ?? "—"}</code> },
          ]}
        />
      </Panel>
    </AdminPage>
  );
}

// ---------- Referrals ----------

type Referrals = {
  rows: {
    id: string;
    status: string;
    sourceCode: string | null;
    rewardMonths: number;
    createdAt: string;
    rewardedAt: string | null;
    referrerId: string;
    referrerEmail: string;
    referredId: string | null;
    referredEmail: string | null;
  }[];
  totals: { signups?: number; rewarded?: number; referrers?: number };
};

export function AdminReferralsPage() {
  const { data, error, isPending } = useAdminQuery<Referrals>("/referrals");
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  return (
    <AdminPage title="推荐" description="通过推荐链接注册的用户。">
      <StatGrid>
        <StatTile label="推荐注册" value={fmt.n(data.totals.signups)} />
        <StatTile label="已发奖励" value={fmt.n(data.totals.rewarded)} />
        <StatTile label="推荐过别人的用户" value={fmt.n(data.totals.referrers)} />
      </StatGrid>
      <Panel flush>
        <DataTable
          rows={data.rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "推荐人", cell: (row) => <UserLink id={row.referrerId} email={row.referrerEmail} /> },
            { header: "新用户", cell: (row) => <UserLink id={row.referredId} email={row.referredEmail} /> },
            { header: "状态", cell: (row) => <StatusBadge status={row.status} /> },
            { header: "奖励", cell: (row) => `${row.rewardMonths} 个月` },
            { header: "注册", cell: (row) => fmt.date(row.createdAt) },
            { header: "发奖", cell: (row) => fmt.date(row.rewardedAt) },
          ]}
        />
      </Panel>
    </AdminPage>
  );
}
