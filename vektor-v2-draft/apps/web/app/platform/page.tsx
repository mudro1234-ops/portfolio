import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { OrgStatusButton, SubscriptionForm } from "@/components/platform-controls";
import { GENERIC_TONE } from "@/lib/status";
import { formatDate, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Platform overview" };

interface OrgRow { organization_id: string; name: string; status: string; plan: string | null; subscription_status: string | null; vehicles: number; members: number; created_at: string }

export default async function PlatformPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: plans }, { data: requests }] = await Promise.all([
    supabase.rpc("platform_overview"),
    supabase.from("plans").select("code").order("sort_order"),
    supabase.from("billing_events").select("id,organization_id,event_type,plan,created_at").in("event_type", ["plan_change_requested", "cancellation_requested"]).order("created_at", { ascending: false }).limit(15),
  ]);
  const orgs = (data ?? []) as OrgRow[];
  const nameOf = new Map(orgs.map((o) => [o.organization_id, o.name]));
  return (
    <>
      <PageHeader title="Platform overview" description="All organisations on VEKTOR. This area manages accounts and subscriptions - it does not expose any customer's fleet data." />
      {error && <div className="mb-4"><Notice tone="red">Could not load organisations. Confirm your account is flagged as a platform administrator.</Notice></div>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Organisations" value={orgs.length} />
        <Stat label="Active" value={orgs.filter((o) => o.status === "active").length} tone="success" />
        <Stat label="Suspended" value={orgs.filter((o) => o.status === "suspended").length} tone={orgs.some((o) => o.status === "suspended") ? "critical" : undefined} />
        <Stat label="Vehicles under management" value={orgs.reduce((s, o) => s + Number(o.vehicles), 0)} />
      </div>
      {(requests ?? []).length > 0 && (
        <Card className="mb-6"><CardHeader title="Pending plan requests" description="Requested by organisation owners. Apply them with the subscription controls below." />
          <ul className="divide-y divide-slate-100">{(requests ?? []).map((r) => (<li key={r.id} className="flex justify-between px-5 py-3 text-sm"><span>{nameOf.get(r.organization_id) ?? "Organisation"} - {r.event_type === "cancellation_requested" ? "cancellation" : `change to ${titleCase(r.plan)}`}</span><span className="text-muted">{formatDate(r.created_at)}</span></li>))}</ul></Card>
      )}
      <Card>
        <CardHeader title="Organisations" />
        {orgs.length === 0 ? <EmptyState title="No organisations yet" /> : (
          <Table><thead><tr><Th>Organisation</Th><Th>Status</Th><Th>Subscription</Th><Th>Vehicles</Th><Th>Members</Th><Th>Created</Th><Th /></tr></thead><tbody>
            {orgs.map((o) => (
              <tr key={o.organization_id} className="align-top">
                <Td className="font-medium">{o.name}</Td>
                <Td><Badge tone={GENERIC_TONE[o.status]}>{titleCase(o.status)}</Badge></Td>
                <Td className="min-w-[420px] py-3"><SubscriptionForm orgId={o.organization_id} plan={o.plan} status={o.subscription_status} plans={(plans ?? []).map((p) => p.code)} /></Td>
                <Td>{o.vehicles}</Td><Td>{o.members}</Td><Td>{formatDate(o.created_at)}</Td>
                <Td className="text-right"><OrgStatusButton id={o.organization_id} status={o.status} /></Td>
              </tr>
            ))}
          </tbody></Table>
        )}
      </Card>
    </>
  );
}
