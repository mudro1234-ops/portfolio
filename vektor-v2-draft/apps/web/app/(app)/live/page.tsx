import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Notice } from "@/components/ui";
import { LiveTracking } from "@/components/live-tracking";
import type { LiveStatusRow } from "@/lib/status";

export const metadata: Metadata = { title: "Live Tracking" };

export default async function LivePage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const ctx = await requireCapability("live");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicle_live_status").select("*").eq("organization_id", ctx.org.id);
  return (
    <>
      <PageHeader title="Live tracking" description="Latest valid positions. A position older than the freshness threshold is labelled stale or offline - it is never shown as live." />
      {error && <div className="mb-4"><Notice tone="red">Vehicle positions could not be loaded.</Notice></div>}
      <LiveTracking orgId={ctx.org.id} timezone={ctx.org.timezone} initial={(data ?? []) as LiveStatusRow[]} initialFilter={sp.state} />
    </>
  );
}
