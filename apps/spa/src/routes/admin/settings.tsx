import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@tmr/ui/components/button";
import { Input } from "@tmr/ui/components/input";
import { AUDIT_ACTION_LABELS, fmt, useAdminAction, useAdminQuery } from "@/lib/admin";
import {
  AdminPage,
  DataTable,
  FilterTabs,
  KeyValues,
  LoadError,
  Loading,
  Panel,
} from "@/components/admin/ui";

type Limits = { freeClassrooms: number; freeNotesUploadsPerMonth: number; uploadsPerUserPerDay: number };
type Prices = { input: number; cachedInput: number; output: number };

type Settings = {
  limits: Limits;
  llmPrices: Prices;
  defaults: { limits: Limits; llmPrices: Prices };
  environment: {
    llmProvider: string;
    llmModel: string;
    emailProvider: string;
    storageProvider: string;
    billingEnabled: boolean;
    stripeConfigured: boolean;
    adminEmails: string[];
  };
};

function NumberForm<T extends Record<string, number>>({
  fields,
  initial,
  defaults,
  step,
  onSave,
}: {
  fields: { key: keyof T & string; label: string; hint?: string }[];
  initial: T;
  defaults: T;
  step?: string;
  onSave: (value: T) => void;
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.key, String(initial[field.key])])),
  );
  const invalid = fields.some((field) => {
    const value = values[field.key];
    return value === undefined || value.trim() === "" || !(Number(value) >= 0);
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(Object.fromEntries(fields.map((field) => [field.key, Number(values[field.key])])) as T);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <label key={field.key} className="space-y-1 text-sm">
            <span className="text-muted-foreground">{field.label}</span>
            <Input
              type="number"
              min={0}
              step={step}
              value={values[field.key]}
              onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
            />
            <span className="block text-xs text-muted-foreground">
              默认 {defaults[field.key]}
              {field.hint ? ` · ${field.hint}` : ""}
            </span>
          </label>
        ))}
      </div>
      <Button size="sm" type="submit" disabled={invalid}>
        保存
      </Button>
    </form>
  );
}

export function AdminSettingsPage() {
  const { data, error, isPending } = useAdminQuery<Settings>("/settings");
  const save = useAdminAction<Partial<{ limits: Limits; llmPrices: Prices }>>("/settings", "put");
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const env = data.environment;
  return (
    <AdminPage title="设置" description="保存后立刻生效，不用重新部署。">
      <Panel title="免费额度">
        <NumberForm<Limits>
          key={JSON.stringify(data.limits)}
          initial={data.limits}
          defaults={data.defaults.limits}
          fields={[
            { key: "freeClassrooms", label: "免费课堂数" },
            { key: "freeNotesUploadsPerMonth", label: "免费每月上传次数" },
            { key: "uploadsPerUserPerDay", label: "每人每天上传上限", hint: "付费用户也受限，防滥用" },
          ]}
          onSave={(limits) => save.mutate({ limits })}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          单个用户的额度可以在用户详情页单独调整。落地页和定价页上写的数字是固定文案，改了这里要记得同步改文案。
        </p>
      </Panel>
      <Panel title="LLM 价格（美元 / 百万 token）">
        <NumberForm<Prices>
          key={JSON.stringify(data.llmPrices)}
          initial={data.llmPrices}
          defaults={data.defaults.llmPrices}
          step="0.001"
          fields={[
            { key: "input", label: "输入（未命中缓存）" },
            { key: "cachedInput", label: "输入（命中缓存）" },
            { key: "output", label: "输出" },
          ]}
          onSave={(llmPrices) => save.mutate({ llmPrices })}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          只影响后台显示的成本，按服务商官网价格填写。改价格会重新计算所有历史成本。
        </p>
      </Panel>
      <Panel title="运行环境（只读，改环境变量后重新部署）">
        <KeyValues
          items={[
            ["LLM", `${env.llmProvider} · ${env.llmModel}`],
            ["邮件", env.emailProvider],
            ["存储", env.storageProvider],
            ["付费功能", env.billingEnabled ? "开启" : "关闭"],
            ["Stripe", env.stripeConfigured ? "已配置" : "未配置"],
            ["管理员（ADMIN_EMAILS）", env.adminEmails.join("、") || "—"],
          ]}
        />
      </Panel>
    </AdminPage>
  );
}

// ---------- Audit ----------

type AuditRow = {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

function AuditTarget({ row }: { row: AuditRow }) {
  if (row.targetType === "user" && row.targetId) {
    return (
      <Link to={`/admin/users/${row.targetId}`} className="text-primary hover:underline">
        用户 {row.targetId.slice(0, 8)}
      </Link>
    );
  }
  if (row.targetType === "job" && row.targetId) {
    return (
      <Link to={`/admin/jobs/${row.targetId}`} className="text-primary hover:underline">
        任务 {row.targetId.slice(0, 8)}
      </Link>
    );
  }
  return <span>{row.targetId ?? "—"}</span>;
}

export function AdminAuditPage() {
  const [params, setParams] = useSearchParams();
  const action = params.get("action") ?? "";
  const before = params.get("before") ?? "";
  const query = new URLSearchParams({ action, before, limit: "100" });
  const { data, error, isPending } = useAdminQuery<{ rows: AuditRow[] }>(`/audit?${query}`);
  const last = data?.rows[data.rows.length - 1];

  return (
    <AdminPage title="操作日志" description="后台的每一次修改，以及每一次查看用户内容。">
      <FilterTabs
        value={action}
        onChange={(value) => setParams(value ? { action: value } : {}, { replace: true })}
        options={[
          { value: "", label: "全部" },
          { value: "view_user_content", label: "查看内容" },
          { value: "disable", label: "封禁" },
          { value: "grant_comp", label: "赠送" },
          { value: "update_settings", label: "设置" },
          { value: "delete_user", label: "删除" },
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
          <>
            <DataTable
              rows={data.rows}
              rowKey={(row) => row.id}
              columns={[
                { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
                { header: "管理员", cell: (row) => row.adminEmail },
                { header: "操作", cell: (row) => AUDIT_ACTION_LABELS[row.action] ?? row.action },
                { header: "对象", cell: (row) => <AuditTarget row={row} /> },
                {
                  header: "详情",
                  cell: (row) => (
                    <code className="block max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(row.detail)}>
                      {Object.keys(row.detail).length ? JSON.stringify(row.detail) : ""}
                    </code>
                  ),
                },
              ]}
            />
            <div className="flex justify-end gap-2 px-4 py-3">
              {before ? (
                <Button size="xs" variant="outline" onClick={() => setParams(action ? { action } : {}, { replace: true })}>
                  回到最新
                </Button>
              ) : null}
              {data.rows.length === 100 && last ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setParams({ ...(action ? { action } : {}), before: last.createdAt }, { replace: true })}
                >
                  更早
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </AdminPage>
  );
}
