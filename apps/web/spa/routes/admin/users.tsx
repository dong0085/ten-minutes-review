import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { Badge } from "@tmr/ui/components/badge";
import { Input } from "@tmr/ui/components/input";
import { fmt, useAdminQuery } from "@/spa/lib/admin";
import { AdminPage, DataTable, FilterTabs, LoadError, Loading, Pager, Panel } from "@/spa/components/admin/ui";

type UserRow = {
  id: string;
  email: string;
  username: string | null;
  isGuest: boolean;
  emailVerifiedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  plan: string | null;
  planStatus: string | null;
  planEnd: string | null;
  classroomCount: number;
  lastActiveAt: string | null;
};

const FILTERS = [
  { value: "registered", label: "注册用户" },
  { value: "paid", label: "付费" },
  { value: "comp", label: "赠送" },
  { value: "disabled", label: "已封禁" },
  { value: "guests", label: "访客" },
  { value: "all", label: "全部" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

const LIMIT = 50;

export function PlanBadge({ plan, status, end }: { plan: string | null; status: string | null; end: string | null }) {
  const live = (status === "active" || status === "trialing") && (!end || new Date(end) > new Date());
  if (!plan || !live) {
    return status === "past_due" ? <Badge variant="destructive">欠费</Badge> : <Badge variant="outline">免费</Badge>;
  }
  return plan === "comp" ? <Badge variant="warning">赠送 Pro</Badge> : <Badge variant="success">Pro</Badge>;
}

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const filter = (params.get("filter") as Filter | null) ?? "registered";
  const offset = Number(params.get("offset") ?? 0);
  const [draft, setDraft] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function search(value: string) {
    setDraft(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value, offset: "0" }), 300);
  }

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ q, filter, offset: String(offset), limit: String(LIMIT) });
  const { data, error, isPending } = useAdminQuery<{ rows: UserRow[]; total: number }>(`/users?${query}`);

  return (
    <AdminPage title="用户" description="按邮箱、用户名或用户 ID 搜索。">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索邮箱 / 用户名 / ID"
            value={draft}
            onChange={(event) => search(event.target.value)}
          />
        </div>
        <FilterTabs value={filter} options={[...FILTERS]} onChange={(value) => update({ filter: value, offset: "0" })} />
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
                  header: "邮箱",
                  cell: (row) => (
                    <Link to={`/admin/users/${row.id}`} className="font-medium text-primary hover:underline">
                      {row.isGuest ? `访客 ${row.id.slice(0, 8)}` : row.email}
                    </Link>
                  ),
                },
                { header: "用户名", cell: (row) => row.username ?? "—" },
                {
                  header: "状态",
                  cell: (row) => (
                    <div className="flex flex-wrap gap-1">
                      <PlanBadge plan={row.plan} status={row.planStatus} end={row.planEnd} />
                      {row.disabledAt ? <Badge variant="destructive">已封禁</Badge> : null}
                      {!row.isGuest && !row.emailVerifiedAt ? <Badge variant="outline">未验证</Badge> : null}
                    </div>
                  ),
                },
                { header: "课堂", cell: (row) => row.classroomCount, className: "text-right tabular-nums" },
                { header: "最近答题", cell: (row) => fmt.ago(row.lastActiveAt) },
                { header: "注册时间", cell: (row) => fmt.date(row.createdAt) },
              ]}
            />
            <Pager
              offset={offset}
              limit={LIMIT}
              count={data.rows.length}
              total={data.total}
              onChange={(next) => update({ offset: String(next) })}
            />
          </>
        )}
      </Panel>
    </AdminPage>
  );
}
