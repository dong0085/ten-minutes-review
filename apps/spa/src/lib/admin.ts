import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";

/** Every admin screen reads through here; keys start with "admin" so one invalidation refreshes them all. */
export function useAdminQuery<T>(path: string, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["admin", path],
    queryFn: () => api.get<T>(`/api/admin${path}`),
    refetchInterval: options?.refetchInterval,
  });
}

/** A POST/PUT to an admin route that toasts the outcome and refreshes admin data. */
export function useAdminAction<B>(path: string, method: "post" | "put" = "post") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: B) =>
      method === "post"
        ? api.post<Record<string, unknown>>(`/api/admin${path}`, body)
        : adminPut<Record<string, unknown>>(path, body),
    onSuccess: () => {
      toast.success("已完成");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "操作失败"),
  });
}

export async function adminPut<T>(path: string, body: unknown) {
  const response = await fetch(`/api/admin${path}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data?.error ?? response.statusText);
  }
  return data;
}

// ---------- Formatting ----------

const numberFormat = new Intl.NumberFormat("zh-CN");
const compactFormat = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });

export const fmt = {
  n: (value: number | null | undefined) => numberFormat.format(Number(value ?? 0)),
  compact: (value: number | null | undefined) => compactFormat.format(Number(value ?? 0)),
  usd: (value: number | null | undefined) => {
    const amount = Number(value ?? 0);
    return `$${amount.toFixed(amount !== 0 && Math.abs(amount) < 1 ? 4 : 2)}`;
  },
  date: (value: string | Date | null | undefined) =>
    value ? new Date(value).toLocaleDateString("zh-CN", { dateStyle: "medium" }) : "—",
  dateTime: (value: string | Date | null | undefined) =>
    value
      ? new Date(value).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })
      : "—",
  ago: (value: string | Date | null | undefined) => {
    if (!value) {
      return "—";
    }
    const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
    const units: [number, Intl.RelativeTimeFormatUnit][] = [
      [60, "second"],
      [60, "minute"],
      [24, "hour"],
      [30, "day"],
      [12, "month"],
      [Infinity, "year"],
    ];
    let amount = seconds;
    for (const [size, unit] of units) {
      if (Math.abs(amount) < size) {
        return new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" }).format(-amount, unit);
      }
      amount = Math.round(amount / size);
    }
    return "—";
  },
  ms: (value: number | null | undefined) => {
    const ms = Number(value ?? 0);
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  },
  bytes: (value: number | null | undefined) => {
    const bytes = Number(value ?? 0);
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  },
};

// ---------- Labels ----------

export const JOB_KIND_LABELS: Record<string, string> = {
  extract: "提取知识点",
  compose: "生成测验",
  send_email: "发送邮件",
  summarize: "考试总结",
  tutor: "AI 导师",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "排队中",
  running: "运行中",
  done: "完成",
  failed: "失败",
  cancelled: "已取消",
  stuck: "卡住",
};

export const LLM_PURPOSE_LABELS: Record<string, string> = {
  extract: "提取",
  compose: "出题",
  summarize: "考试总结",
  tutor: "AI 导师",
};

export const EXTRACTION_STATUS_LABELS: Record<string, string> = {
  pending: "等待中",
  running: "提取中",
  done: "完成",
  failed: "失败",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  sign_out: "强制退出登录",
  revoke_tokens: "吊销全部 API token",
  revoke_token: "吊销 API token",
  verify_email: "标记邮箱已验证",
  grant_comp: "赠送 Pro",
  end_comp: "结束赠送 Pro",
  set_limits: "设置个人额度",
  daily_email: "每日邮件开关",
  disable: "封禁账号",
  enable: "解除封禁",
  sync_stripe: "从 Stripe 同步",
  delete_user: "删除账号",
  view_user_content: "查看用户内容",
  reextract_upload: "重新提取笔记",
  retry_job: "重试任务",
  cancel_job: "取消任务",
  update_settings: "修改设置",
};

export function statusTone(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (["done", "active", "trialing", "rewarded"].includes(status)) {
    return "success";
  }
  if (["failed", "stuck", "canceled", "unpaid", "incomplete_expired"].includes(status)) {
    return "destructive";
  }
  if (["running", "pending", "past_due", "incomplete", "signed_up"].includes(status)) {
    return "warning";
  }
  return "secondary";
}
