import Link from "next/link";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { getAppContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { MarkAllReadButton } from "@/components/mark-read-button";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", ctx.userId).eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).limit(50);
  return (
    <>
      <PageHeader title="Notifications" description="Warnings and critical alerts sent to you in the app." actions={(data ?? []).some((n) => !n.read_at) ? <MarkAllReadButton /> : undefined} />
      <div className="mb-4"><Notice tone="blue">In-app notifications are active. Email, SMS and push delivery need an external provider and are not connected yet.</Notice></div>
      <Card>
        {(data ?? []).length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" />} title="You're all caught up" description="New warning and critical alerts will appear here." /> : (
          <ul className="divide-y divide-slate-100">
            {(data ?? []).map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "/alerts"} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-slate-300" : "bg-brand"}`} aria-label={n.read_at ? "Read" : "Unread"} />
                  <div className="min-w-0"><p className="text-sm font-medium text-ink">{n.title}</p>{n.body && <p className="text-sm text-muted">{n.body}</p>}<p className="mt-1 text-xs text-muted">{formatDateTime(n.created_at, ctx.org.timezone)}</p></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
