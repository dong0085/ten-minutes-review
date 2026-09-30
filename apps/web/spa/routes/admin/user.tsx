import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Input } from "@tmr/ui/components/input";
import { AUDIT_ACTION_LABELS, fmt, useAdminAction, useAdminQuery } from "@/spa/lib/admin";
import {
  AdminPage,
  ConfirmButton,
  DataTable,
  KeyValues,
  LoadError,
  Loading,
  Panel,
  StatGrid,
  StatTile,
  StatusBadge,
  UserLink,
} from "@/spa/components/admin/ui";
import { PlanBadge } from "./users";

type Detail = {
  user: {
    id: string;
    email: string;
    username: string | null;
    isGuest: boolean;
    emailVerifiedAt: string | null;
    disabledAt: string | null;
    disabledReason: string | null;
    uiLanguage: string;
    timezone: string;
    createdAt: string;
    hasPassword: boolean;
  };
  accounts: { provider: string }[];
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  emailPreferences: { dailyEnabled: boolean; sendHourLocal: number; unsubscribedAt: string | null } | null;
  classrooms: {
    id: string;
    name: string;
    targetLanguage: string;
    nativeLanguage: string;
    activeUntil: string;
    pausedAt: string | null;
    archivedAt: string | null;
    bankSize: number;
    uploadCount: number;
    quizCount: number;
  }[];
  apiTokens: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }[];
  usage: {
    uploadsThisWeek: number;
    uploadsTotal: number;
    attemptsTotal: number;
    attempts30d: number;
    lastActiveAt: string | null;
    emailsSent: number;
    tutorRequests: number;
  };
  llm: { calls: number; failed: number; costUsd: number };
  effectiveLimits: { classrooms: number; notesUploadsPerWeek: number };
  referrals: { id: string; status: string; createdAt: string; userId: string; email: string }[];
  referredBy: { userId: string; email: string; status: string } | null;
  limitOverride: { classrooms: number | null; notesUploadsPerWeek: number | null; note: string | null } | null;
  emails: { id: string; sentOn: string; kind: string; providerMessageId: string | null; createdAt: string }[];
  audit: { id: string; action: string; adminEmail: string; detail: Record<string, unknown>; createdAt: string }[];
  stripeDashboard: string;
};

type Action = { action: string } & Record<string, unknown>;

function LimitsForm({ detail, run }: { detail: Detail; run: (body: Action) => void }) {
  const override = detail.limitOverride;
  const [classrooms, setClassrooms] = useState(override?.classrooms?.toString() ?? "");
  const [uploads, setUploads] = useState(override?.notesUploadsPerWeek?.toString() ?? "");
  const [note, setNote] = useState(override?.note ?? "");
  const parse = (value: string) => (value.trim() === "" ? null : Math.max(0, Math.floor(Number(value))));
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        run({ action: "set_limits", classrooms: parse(classrooms), notesUploadsPerWeek: parse(uploads), note: note || null });
      }}
    >
      <p className="text-xs text-muted-foreground">
        只对免费用户生效。留空就用全局设置（现在：{detail.effectiveLimits.classrooms} 个课堂，每周{" "}
        {detail.effectiveLimits.notesUploadsPerWeek} 次上传）。
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">课堂上限</span>
          <Input type="number" min={0} value={classrooms} onChange={(event) => setClassrooms(event.target.value)} placeholder="全局" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">每周上传</span>
          <Input type="number" min={0} value={uploads} onChange={(event) => setUploads(event.target.value)} placeholder="全局" />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">备注</span>
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="为什么调整" />
      </label>
      <Button size="sm" type="submit">
        保存额度
      </Button>
    </form>
  );
}

export function AdminUserPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { data, error, isPending } = useAdminQuery<Detail>(`/users/${userId}`);
  const action = useAdminAction<Action>(`/users/${userId}`);
  const run = (body: Action) =>
    action.mutate(body, {
      onSuccess: (result) => {
        if (result.deleted) {
          navigate("/admin/users");
        }
      },
    });

  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const { user, subscription } = data;
  const signIns = [user.hasPassword ? "密码" : null, ...data.accounts.map((account) => account.provider)].filter(Boolean);
  const isComp = subscription?.plan === "comp";
  const activeTokens = data.apiTokens.filter((token) => !token.revokedAt);

  return (
    <AdminPage
      title={user.isGuest ? `访客 ${user.id.slice(0, 8)}` : user.email}
      description={
        <span className="flex flex-wrap items-center gap-1.5">
          <PlanBadge plan={subscription?.plan ?? null} status={subscription?.status ?? null} end={subscription?.currentPeriodEnd ?? null} />
          {user.disabledAt ? <Badge variant="destructive">已封禁</Badge> : null}
          {user.isGuest ? <Badge variant="outline">访客</Badge> : null}
          {!user.isGuest && !user.emailVerifiedAt ? <Badge variant="outline">邮箱未验证</Badge> : null}
        </span>
      }
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link to="/admin/users">
            <ArrowLeft className="size-4" /> 用户列表
          </Link>
        </Button>
      }
    >
      {user.disabledAt ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {fmt.dateTime(user.disabledAt)} 封禁：{user.disabledReason}
        </div>
      ) : null}

      <StatGrid>
        <StatTile label="本周上传" value={`${data.usage.uploadsThisWeek} / ${data.effectiveLimits.notesUploadsPerWeek}`} hint={`累计 ${data.usage.uploadsTotal}`} />
        <StatTile label="答题次数" value={fmt.n(data.usage.attemptsTotal)} hint={`近 30 天 ${data.usage.attempts30d} · 最近 ${fmt.ago(data.usage.lastActiveAt)}`} />
        <StatTile label="LLM 成本（累计）" value={fmt.usd(data.llm.costUsd)} hint={`${data.llm.calls} 次调用 · 失败 ${data.llm.failed}`} />
        <StatTile label="收到邮件" value={fmt.n(data.usage.emailsSent)} hint={`AI 导师请求 ${data.usage.tutorRequests}`} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="账号">
          <KeyValues
            items={[
              ["用户 ID", <code key="id" className="text-xs">{user.id}</code>],
              ["用户名", user.username ?? "—"],
              ["注册时间", fmt.dateTime(user.createdAt)],
              ["邮箱验证", user.emailVerifiedAt ? fmt.dateTime(user.emailVerifiedAt) : "未验证"],
              ["登录方式", signIns.join("、") || "—"],
              ["语言 / 时区", `${user.uiLanguage} · ${user.timezone}`],
              ["推荐人", data.referredBy ? <UserLink id={data.referredBy.userId} email={data.referredBy.email} /> : "—"],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {!user.emailVerifiedAt && !user.isGuest ? (
              <ConfirmButton label="标记邮箱已验证" title="把这个邮箱标记为已验证？" onConfirm={() => run({ action: "verify_email" })} />
            ) : null}
            <ConfirmButton
              label="强制退出登录"
              title="让这个用户在所有设备上退出登录？"
              description="API token 不受影响，需要的话单独吊销。"
              onConfirm={() => run({ action: "sign_out" })}
            />
          </div>
        </Panel>

        <Panel title="套餐">
          <KeyValues
            items={[
              ["方案", subscription ? `${subscription.plan}（${subscription.status}）` : "免费"],
              ["到期", subscription?.currentPeriodEnd ? fmt.dateTime(subscription.currentPeriodEnd) : "—"],
              ["周期末取消", subscription?.cancelAtPeriodEnd ? "是" : "否"],
              [
                "Stripe 客户",
                subscription?.stripeCustomerId ? (
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={`${data.stripeDashboard}/customers/${subscription.stripeCustomerId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {subscription.stripeCustomerId} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  "—"
                ),
              ],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <ConfirmButton
              label={isComp ? "延长赠送" : "赠送 Pro"}
              title="赠送 Pro"
              description={isComp ? "从当前到期日往后延长。" : "从今天开始算。已有 Stripe 订阅的用户不能赠送。"}
              input={{ label: "月数", type: "number", defaultValue: "1" }}
              onConfirm={(value) => run({ action: "grant_comp", months: Number(value) })}
            />
            {isComp ? (
              <ConfirmButton label="结束赠送" title="立刻结束赠送的 Pro？" destructive onConfirm={() => run({ action: "end_comp" })} />
            ) : null}
            {subscription?.stripeCustomerId ? (
              <ConfirmButton
                label="从 Stripe 同步"
                title="从 Stripe 拉取最新订阅状态？"
                description="用在 webhook 漏掉、状态对不上的时候。"
                onConfirm={() => run({ action: "sync_stripe" })}
              />
            ) : null}
          </div>
        </Panel>

        <Panel title="个人额度">
          <LimitsForm key={JSON.stringify(data.limitOverride)} detail={data} run={run} />
        </Panel>

        <Panel title="每日邮件">
          <KeyValues
            items={[
              ["每日测验邮件", data.emailPreferences?.dailyEnabled === false ? "关闭" : "开启"],
              ["发送时间", `${data.emailPreferences?.sendHourLocal ?? 7}:00（用户时区）`],
              ["退订", data.emailPreferences?.unsubscribedAt ? fmt.dateTime(data.emailPreferences.unsubscribedAt) : "—"],
            ]}
          />
          <div className="mt-4">
            <ConfirmButton
              label={data.emailPreferences?.dailyEnabled === false ? "打开每日邮件" : "关闭每日邮件"}
              title={data.emailPreferences?.dailyEnabled === false ? "为这个用户打开每日邮件？" : "为这个用户关闭每日邮件？"}
              onConfirm={() => run({ action: "daily_email", enabled: data.emailPreferences?.dailyEnabled === false })}
            />
          </div>
        </Panel>
      </div>

      <Panel title={`课堂（${data.classrooms.length}）`} flush>
        <DataTable
          rows={data.classrooms}
          rowKey={(row) => row.id}
          columns={[
            {
              header: "名称",
              cell: (row) => (
                <Link to={`/admin/users/${user.id}/classrooms/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.name}
                </Link>
              ),
            },
            { header: "语言", cell: (row) => `${row.targetLanguage} ← ${row.nativeLanguage}` },
            {
              header: "状态",
              cell: (row) =>
                row.archivedAt ? (
                  <Badge variant="outline">已归档</Badge>
                ) : row.pausedAt ? (
                  <Badge variant="warning">已暂停</Badge>
                ) : new Date(row.activeUntil) > new Date() ? (
                  <Badge variant="success">每日测验中</Badge>
                ) : (
                  <Badge variant="secondary">未激活</Badge>
                ),
            },
            { header: "知识点", cell: (row) => row.bankSize, className: "text-right tabular-nums" },
            { header: "上传", cell: (row) => row.uploadCount, className: "text-right tabular-nums" },
            { header: "测验", cell: (row) => row.quizCount, className: "text-right tabular-nums" },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={`API token（有效 ${activeTokens.length}）`}
          action={
            activeTokens.length > 0 ? (
              <ConfirmButton size="xs" label="全部吊销" title="吊销这个用户的全部 API token？" destructive onConfirm={() => run({ action: "revoke_tokens" })} />
            ) : null
          }
          flush
        >
          <DataTable
            rows={data.apiTokens}
            rowKey={(row) => row.id}
            empty="没有 token"
            columns={[
              { header: "名称", cell: (row) => `${row.name}（${row.prefix}…）` },
              { header: "最近使用", cell: (row) => fmt.ago(row.lastUsedAt) },
              {
                header: "",
                cell: (row) =>
                  row.revokedAt ? (
                    <span className="text-xs text-muted-foreground">已吊销</span>
                  ) : (
                    <ConfirmButton size="xs" label="吊销" title={`吊销 ${row.name}？`} destructive onConfirm={() => run({ action: "revoke_token", tokenId: row.id })} />
                  ),
              },
            ]}
          />
        </Panel>

        <Panel title={`推荐的用户（${data.referrals.length}）`} flush>
          <DataTable
            rows={data.referrals}
            rowKey={(row) => row.id}
            empty="还没有推荐过别人"
            columns={[
              { header: "用户", cell: (row) => <UserLink id={row.userId} email={row.email} /> },
              { header: "状态", cell: (row) => <StatusBadge status={row.status} /> },
              { header: "时间", cell: (row) => fmt.date(row.createdAt) },
            ]}
          />
        </Panel>
      </div>

      <Panel title="最近邮件" flush>
        <DataTable
          rows={data.emails}
          rowKey={(row) => row.id}
          empty="没有发过邮件"
          columns={[
            { header: "日期", cell: (row) => row.sentOn },
            { header: "类型", cell: (row) => row.kind },
            { header: "发送时间", cell: (row) => fmt.dateTime(row.createdAt) },
            { header: "服务商 ID", cell: (row) => <code className="text-xs">{row.providerMessageId ?? "—"}</code> },
          ]}
        />
      </Panel>

      <Panel title="后台操作记录" flush>
        <DataTable
          rows={data.audit}
          rowKey={(row) => row.id}
          empty="没有记录"
          columns={[
            { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
            { header: "操作", cell: (row) => AUDIT_ACTION_LABELS[row.action] ?? row.action },
            {
              header: "详情",
              cell: (row) => <code className="text-xs text-muted-foreground">{Object.keys(row.detail).length ? JSON.stringify(row.detail) : ""}</code>,
            },
          ]}
        />
      </Panel>

      <Panel title="危险操作" className="border-destructive/30">
        <div className="flex flex-wrap gap-2">
          {user.disabledAt ? (
            <ConfirmButton label="解除封禁" title="解除封禁，让这个用户重新登录？" onConfirm={() => run({ action: "enable" })} />
          ) : (
            <ConfirmButton
              label="封禁账号"
              title="封禁这个账号？"
              description="用户会立刻退出登录，API token 全部吊销，每日测验和邮件停止。数据保留，可以随时解除。"
              destructive
              input={{ label: "封禁原因（只有后台能看到）" }}
              onConfirm={(reason) => run({ action: "disable", reason })}
            />
          )}
          <ConfirmButton
            label="删除账号"
            title="永久删除这个账号？"
            description="课堂、笔记、测验、答题记录全部删除，无法恢复。有 Stripe 订阅的用户要先在 Stripe 里取消订阅。"
            destructive
            confirmText={user.email}
            onConfirm={(value) => run({ action: "delete", confirmEmail: value })}
          />
        </div>
      </Panel>
    </AdminPage>
  );
}
