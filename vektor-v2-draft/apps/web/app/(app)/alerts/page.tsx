import Link from "next/link";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, FilterBar, PageHeader, Pagination, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { AlertRowActions } from "@/components/alert-controls";
import { GENERIC_TONE, SEVERITY_TONE } from "@/lib/status";
import { formatDateTime, titleCase } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata: Metadata = { title: "Alerts" };
const TYPES = ["geofence_entry", "geofence_exit", "device_offline", "overspeed", "maintenance_due", "unusual_movement", "restricted_area", "power_disconnected", "other"];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; type?: string; page?: string }> }) {
  const ctx = await requireCapability("alerts");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase.from("alerts").select("*,vehicle:vehicles(id,registration_number),driver:drivers(full_name)", { count: "exact" }).eq("organization_id", ctx.org.id);
  if (sp.status === "active") query = query.neq("status", "resolved");
  else if (sp.status) query = query.eq("status", sp.status);
  if (sp.severity) query = query.eq("severity", sp.severity);
  if (sp.type) query = query.eq("type", sp.type);
  const { data, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const canManage = can(ctx.role, "alerts.manage");
  const filtered = !!(sp.status || sp.severity || sp.type);

  return (
    <>
      <PageHeader title="Alerts" description="Operational events that need attention: geofence crossings, offline trackers, speeding and maintenance." />
      <Card>
        <FilterBar resetHref="/alerts">
          <div className="w-40"><label htmlFor="status" className={labelClass}>Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}><option value="">All</option><option value="active">Not resolved</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option></select></div>
          <div className="w-40"><label htmlFor="severity" className={labelClass}>Severity</label><select id="severity" name="severity" defaultValue={sp.severity ?? ""} className={inputClass}><option value="">All</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Informational</option></select></div>
          <div className="w-48"><label htmlFor="type" className={labelClass}>Type</label><select id="type" name="type" defaultValue={sp.type ?? ""} className={inputClass}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></div>
        </FilterBar>
        {(data ?? []).length === 0 ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title={filtered ? "No alerts match your filters" : "No alerts"} description={filtered ? "Try resetting the filters." : "Alerts appear here when something needs attention."} />
        ) : (
          <>
            <Table><thead><tr><Th>When</Th><Th>Alert</Th><Th>Vehicle</Th><Th>Severity</Th><Th>Status</Th>{canManage && <Th />}</tr></thead><tbody>
              {(data ?? []).map((a) => {
                const v = (Array.isArray(a.vehicle) ? a.vehicle[0] : a.vehicle) as { id: string; registration_number: string } | null;
                const d = (Array.isArray(a.driver) ? a.driver[0] : a.driver) as { full_name: string } | null;
                return (
                  <tr key={a.id} className="align-top hover:bg-slate-50">
                    <Td className="whitespace-nowrap">{formatDateTime(a.created_at, ctx.org.timezone)}</Td>
                    <Td className="max-w-md"><p className="font-medium">{a.title}</p>{a.description && <p className="text-xs text-muted">{a.description}</p>}{d && <p className="text-xs text-muted">Driver: {d.full_name}</p>}{a.resolution_notes && <p className="mt-1 text-xs text-muted">Resolution: {a.resolution_notes}</p>}</Td>
                    <Td>{v ? <Link href={`/vehicles/${v.id}`} className="text-brand hover:underline">{v.registration_number}</Link> : "-"}</Td>
                    <Td><Badge tone={SEVERITY_TONE[a.severity]}>{titleCase(a.severity)}</Badge></Td>
                    <Td><Badge tone={GENERIC_TONE[a.status]}>{titleCase(a.status)}</Badge></Td>
                    {canManage && <Td className="text-right"><AlertRowActions id={a.id} status={a.status} /></Td>}
                  </tr>
                );
              })}
            </tbody></Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/alerts" params={{ status: sp.status, severity: sp.severity, type: sp.type }} />
          </>
        )}
      </Card>
    </>
  );
}
