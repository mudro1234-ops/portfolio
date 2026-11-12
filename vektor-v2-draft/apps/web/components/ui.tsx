import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { STATUS_META, type DisplayStatus, type Tone } from "@/lib/status";

/* ---------- Buttons ---------- */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md") {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
    variant === "primary" && "bg-brand text-white hover:bg-brand-600",
    variant === "secondary" && "border border-slate-300 bg-white text-ink hover:bg-slate-50",
    variant === "danger" && "bg-critical text-white hover:bg-red-600",
    variant === "ghost" && "text-muted hover:bg-slate-100 hover:text-ink",
  );
}
export function LinkButton({ href, children, variant = "primary", size = "md", className }: {
  href: string; children: ReactNode; variant?: ButtonVariant; size?: "sm" | "md"; className?: string;
}) {
  return <Link href={href} className={clsx(buttonClass(variant, size), className)}>{children}</Link>;
}

/* ---------- Layout ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-card border border-slate-200 bg-white shadow-card", className)}>{children}</section>;
}
export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Badges ---------- */
const TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  grey: "bg-slate-100 text-slate-600 ring-slate-500/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  slate: "bg-slate-50 text-slate-600 ring-slate-400/30",
};
const DOTS: Record<Tone, string> = {
  green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", grey: "bg-slate-400",
  purple: "bg-violet-500", blue: "bg-blue-500", slate: "bg-slate-400",
};
export function Badge({ tone = "grey", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone])}>
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden />}
      {children}
    </span>
  );
}
/** Status is always colour + text, never colour alone. */
export function StatusBadge({ status }: { status: DisplayStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* ---------- KPI ---------- */
export function Stat({ label, value, href, hint, tone }: {
  label: string; value: ReactNode; href?: string; hint?: string; tone?: "critical" | "warning" | "success";
}) {
  const body = (
    <div className="h-full rounded-card border border-slate-200 bg-white p-4 shadow-card transition-colors hover:border-brand/40">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={clsx("mt-2 text-2xl font-semibold",
        tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-card">{body}</Link> : body;
}

/* ---------- Tables ---------- */
export function Table({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>;
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={clsx("border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("h-[52px] border-b border-slate-100 px-4 align-middle text-ink", className)}>{children}</td>;
}

export function Pagination({ page, pageSize, total, basePath, params }: {
  page: number; pageSize: number; total: number; basePath: string; params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v) sp.set(k, v); });
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
      <span>Page {page} of {pages} - {total.toLocaleString()} records</span>
      <div className="flex gap-2">
        {page > 1 && <LinkButton href={href(page - 1)} variant="secondary" size="sm">Previous</LinkButton>}
        {page < pages && <LinkButton href={href(page + 1)} variant="secondary" size="sm">Next</LinkButton>}
      </div>
    </div>
  );
}

export function Notice({ tone = "blue", title, children }: { tone?: "blue" | "amber" | "red" | "green"; title?: string; children: ReactNode }) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div role="status" className={clsx("rounded-lg border px-4 py-3 text-sm", styles[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50";
export const labelClass = "mb-1 block text-xs font-medium text-ink";

/** Search / filter bar rendered as a plain GET form so it works without JavaScript. */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-3">
      {children}
      <button type="submit" className={buttonClass("secondary", "sm")}>Apply</button>
      <Link href={resetHref} className={buttonClass("ghost", "sm")}>Reset</Link>
    </form>
  );
}
