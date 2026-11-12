import type { Metadata } from "next";
import { History } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, FilterBar, PageHeader, Pagination, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };
const PER_PAGE = 30;
const ENTITIES = ["vehicles", "drivers", "gps_devices", "vehicle_assignments", "geofences", "maintenance_records", "fuel_records", "organization_memberships", "organization_invitations", "organizations", "subscription_accounts"];

function summarise(action: string, details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const d = details as Record<string, unknown>;
  if (action === "update") return Object.keys(d).filter((k) => !["updated_at"].includes(k)).slice(0, 6).map((k) => k.replace(/_/g, " ")).join(", ");
  const label = (d.registration_number ?? d.full_name ?? d.imei ?? d.name ?? d.email ?? d.maintenance_type) as string | undefined;
  return label ? String(label) : "";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  const ctx = await requireCapability("audit");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase.from("audit_logs").select("id,action,entity,entity_id,details,created_at,actor_id", { count: "exact" }).eq("organization_id", ctx.org.id);
  if (sp.entity) query = query.eq("entity", sp.entity);
  const { data, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const actorIds = [...new Set((data ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("user_profiles").select("id,full_name,email").in("id", actorIds) : { data: [] };
  const actorOf = new Map((actors ?? []).map((a) => [a.id, a.full_name ?? a.email]));

  return (
    <>
      <PageHeader title="Audit log" description="A record of important changes in your organisation. Visible to owners and administrators only." />
      <Card>
        <FilterBar resetHref="/audit"><div className="w-56"><label htmlFor="entity" className={labelClass}>Record type</label>
          <select id="entity" name="entity" defaultValue={sp.entity ?? ""} className={inputClass}><option value="">All</option>{ENTITIES.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}</select></div></FilterBar>
        {(data ?? []).length === 0 ? <EmptyState icon={<History className="h-6 w-6" />} title="No audit entries" /> : (
          <>
            <Table><thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Record</Th><Th>Detail</Th></tr></thead><tbody>
              {(data ?? []).map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(l.created_at, ctx.org.timezone)}</Td>
                  <Td>{l.actor_id ? actorOf.get(l.actor_id) ?? "User" : <span className="text-muted">System / automation</span>}</Td>
                  <Td><Badge tone={l.action === "delete" ? "red" : l.action === "insert" ? "green" : "blue"}>{l.action === "insert" ? "Created" : l.action === "update" ? "Changed" : "Deleted"}</Badge></Td>
                  <Td>{titleCase(l.entity)}</Td>
                  <Td className="max-w-xs truncate text-muted">{summarise(l.action, l.details)}</Td>
                </tr>
              ))}
            </tbody></Table>
            <Pagination page={page} pageSize={PER_PAGE} total={count ?? 0} basePath="/audit" params={{ entity: sp.entity }} />
          </>
        )}
      </Card>
    </>
  );
}
