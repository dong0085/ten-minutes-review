import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@tmr/ui/components/alert-dialog";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { Input } from "@tmr/ui/components/input";
import { cn } from "@tmr/ui/utils";
import { statusTone } from "@/spa/lib/admin";

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card/75", className)}>
      {title || action ? (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Loading() {
  return (
    <div className="grid place-items-center py-20" role="status">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <span className="sr-only">加载中</span>
    </div>
  );
}

export function LoadError({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      加载失败：{error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
  to,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "warning" | "destructive";
  to?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-semibold tabular-nums tracking-[-0.02em]",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const className = "block rounded-2xl border border-border/70 bg-card/75 px-4 py-3";
  return to ? (
    <Link to={to} className={cn(className, "transition-colors hover:border-primary/30 hover:bg-primary/[0.03]")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}

/**
 * One series over days: thin bars from a shared baseline, a hover tooltip per bar,
 * and the latest value labelled. The panel title names the series.
 */
export function DailyBars({
  data,
  format = (value) => String(value),
  height = 120,
}: {
  data: { day: string; value: number }[];
  format?: (value: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const active = hover === null ? null : data[hover];
  const last = data[data.length - 1];
  return (
    <figure className="space-y-2">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          {active ? (
            <>
              <span className="text-foreground">{active.day}</span> · {format(active.value)}
            </>
          ) : (
            <>合计 {format(total)}</>
          )}
        </span>
        <span>最近一天 {last ? format(last.value) : "—"}</span>
      </div>
      <div
        className="relative flex items-end gap-[2px]"
        style={{ height }}
        role="img"
        aria-labelledby={`${id}-desc`}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((point, index) => (
          <div
            key={point.day}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(index)}
            onFocus={() => setHover(index)}
            tabIndex={0}
            aria-label={`${point.day}: ${format(point.value)}`}
          >
            <div
              className={cn(
                "w-full rounded-t-[4px] bg-primary/70 transition-colors",
                hover === index && "bg-primary",
                point.value === 0 && "bg-border",
              )}
              style={{ height: point.value === 0 ? 2 : Math.max(3, (point.value / max) * height) }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{data[0]?.day.slice(5)}</span>
        <span>{last?.day.slice(5)}</span>
      </div>
      <figcaption id={`${id}-desc`} className="sr-only">
        {data.map((point) => `${point.day} ${format(point.value)}`).join("，")}
      </figcaption>
    </figure>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge variant={statusTone(status)}>{label ?? status}</Badge>;
}

export function KeyValues({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([key, value], index) => (
        <div key={index} className="contents">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A plain table with a horizontal scroll inside the panel, so the page never scrolls sideways. */
export function DataTable<T>({
  rows,
  columns,
  empty = "没有数据",
  rowKey,
}: {
  rows: T[];
  columns: { header: ReactNode; cell: (row: T) => ReactNode; className?: string }[];
  empty?: ReactNode;
  rowKey: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
            {columns.map((column, index) => (
              <th key={index} className={cn("px-4 py-2 font-medium", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                {columns.map((column, index) => (
                  <td key={index} className={cn("px-4 py-2 align-top", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function FilterTabs<V extends string>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: ReactNode }[];
  onChange: (value: V) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-card/60 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs transition-colors",
            option.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Pager({
  offset,
  limit,
  count,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  count: number;
  total?: number;
  onChange: (offset: number) => void;
}) {
  const hasNext = total === undefined ? count === limit : offset + count < total;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
      <span>
        {count === 0 ? "0" : `${offset + 1}–${offset + count}`}
        {total !== undefined ? ` / 共 ${total}` : ""}
      </span>
      <div className="flex gap-2">
        <Button size="xs" variant="outline" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          上一页
        </Button>
        <Button size="xs" variant="outline" disabled={!hasNext} onClick={() => onChange(offset + limit)}>
          下一页
        </Button>
      </div>
    </div>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-xl bg-muted/60 p-3 text-xs leading-5">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function UserLink({ id, email }: { id: string | null | undefined; email?: string | null }) {
  if (!id) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Link to={`/admin/users/${id}`} className="text-primary hover:underline">
      {email ?? id.slice(0, 8)}
    </Link>
  );
}

/**
 * A button that asks before acting. With `confirmText`, the admin must type that
 * text (an email address, say) before the action unlocks.
 */
export function ConfirmButton({
  label,
  title,
  description,
  onConfirm,
  destructive,
  confirmText,
  input,
  disabled,
  size = "sm",
}: {
  label: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  onConfirm: (value: string) => void;
  destructive?: boolean;
  confirmText?: string;
  input?: { label: string; placeholder?: string; defaultValue?: string; type?: "text" | "number" };
  disabled?: boolean;
  size?: "xs" | "sm";
}) {
  const [value, setValue] = useState(input?.defaultValue ?? "");
  const locked =
    (confirmText !== undefined && value.trim().toLowerCase() !== confirmText.toLowerCase()) ||
    (input !== undefined && value.trim() === "");
  return (
    <AlertDialog onOpenChange={(open) => open && setValue(input?.defaultValue ?? "")}>
      <AlertDialogTrigger asChild>
        <Button size={size} variant={destructive ? "destructive" : "outline"} disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {input || confirmText !== undefined ? (
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">{input?.label ?? `输入 ${confirmText} 以确认`}</span>
            <Input
              type={input?.type ?? "text"}
              value={value}
              placeholder={input?.placeholder ?? confirmText}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={locked}
            onClick={() => onConfirm(value.trim())}
          >
            确认
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
