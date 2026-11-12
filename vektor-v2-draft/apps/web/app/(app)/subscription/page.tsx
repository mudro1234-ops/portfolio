import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, Notice, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { CancelButton, RequestPlanButton } from "@/components/subscription-controls";
import { GENERIC_TONE } from "@/lib/status";
import { formatDate, formatDateTime, formatMoney, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Subscription" };

export default async function SubscriptionPage() {
  const ctx = await requireCapability("billing");
  const supabase = await createClient();
  const [{ data: sub }, { data: plans }, { data: events }, { count: vehicleCount }, { count: memberCount }] = await Promise.all([
    supabase.from("subscription_accounts").select("*").eq("organization_id", ctx.org.id).maybeSingle(),
    supabase.from("plans").select("*").order("sort_order"),
    supabase.from("billing_events").select("*").eq("organization_id", ctx.org.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).neq("status", "retired"),
    supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).eq("status", "active"),
  ]);
  const isOwner = ctx.role === "owner";
  const trialDays = sub?.trial_ends_at ? Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000) : null;

  return (
    <>
      <PageHeader title="Subscription" description="Your plan, vehicle allowance and billing history." />
      <div className="mb-6"><Notice tone="amber" title="Online payment is not connected yet">Plan changes are requested here and confirmed by VEKTOR. Prices shown are indicative test prices, billed per vehicle (or per driver for the smartphone-only plan), and hardware is charged separately.</Notice></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Plan" value={titleCase(sub?.plan)} />
        <Stat label="Status" value={<Badge tone={GENERIC_TONE[sub?.status ?? "active"]}>{titleCase(sub?.status)}</Badge>} hint={sub?.status === "trialing" && trialDays !== null ? (trialDays >= 0 ? `${trialDays} days left` : "Trial ended") : sub?.current_period_end ? `Renews ${formatDate(sub.current_period_end)}` : undefined} tone={sub?.status === "past_due" ? "critical" : undefined} />
        <Stat label="Vehicles" value={sub?.vehicle_limit ? `${vehicleCount ?? 0} / ${sub.vehicle_limit}` : `${vehicleCount ?? 0}`} hint={sub?.vehicle_limit ? undefined : "No limit set"} />
        <Stat label="Team members" value={sub?.user_limit ? `${memberCount ?? 0} / ${sub.user_limit}` : `${memberCount ?? 0}`} />
      </div>
      <Card className="mb-6">
        <CardHeader title="Plans" description="Indicative monthly prices (USD)" />
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {(plans ?? []).map((p) => (
            <div key={p.code} className={`rounded-card border p-4 ${sub?.plan === p.code ? "border-brand bg-brand-50" : "border-slate-200"}`}>
              <h3 className="font-semibold text-ink">{p.name}</h3>
              <p className="mt-1 text-2xl font-semibold text-ink">{formatMoney(p.price_usd, "USD")}<span className="text-sm font-normal text-muted"> / {p.billing_unit}{p.code === "enterprise" ? "+" : ""}</span></p>
              <p className="mt-2 min-h-[60px] text-sm text-muted">{p.description}</p>
              {isOwner && <div className="mt-3"><RequestPlanButton code={p.code} current={sub?.plan === p.code} /></div>}
            </div>
          ))}
        </div>
        {!isOwner && <p className="border-t border-slate-100 px-5 py-3 text-xs text-muted">Only the organisation owner can request plan changes.</p>}
      </Card>
      <Card>
        <CardHeader title="Billing history" action={isOwner && sub?.status !== "cancelled" ? <CancelButton /> : undefined} />
        {(events ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No billing activity yet.</p> : (
          <Table><thead><tr><Th>Date</Th><Th>Event</Th><Th>Plan</Th><Th>Amount</Th><Th>Note</Th></tr></thead><tbody>
            {(events ?? []).map((e) => (<tr key={e.id}><Td>{formatDateTime(e.created_at, ctx.org.timezone)}</Td><Td>{titleCase(e.event_type)}</Td><Td>{e.plan ? titleCase(e.plan) : "-"}</Td><Td>{e.amount_usd != null ? formatMoney(e.amount_usd, e.currency) : "-"}</Td><Td>{e.note ?? e.reference ?? "-"}</Td></tr>))}
          </tbody></Table>
        )}
      </Card>
    </>
  );
}
