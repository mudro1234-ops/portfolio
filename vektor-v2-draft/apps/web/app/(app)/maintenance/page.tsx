import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Wrench } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, FilterBar, LinkButton, PageHeader, Pagination, Stat, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { MaintenanceRowActions } from "@/components/maintenance-controls";
import { GENERIC_TONE } from "@/lib/status";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ status?: string; vehicle?: string; page?: string }> }) {
  const ctx = await requireCapability("maintenance");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase.from("maintenance_records").select("*,vehicle:vehicles(id,registration_number)", { count: "exact" }).eq("organization_id", ctx.org.id);
  if (sp.status === "overdue") query = query.in("status", ["scheduled", "in_progress"]).lt("service_date", today);
  else if (sp.status) query = query.eq("status", sp.status);
  if (sp.vehicle) query = query.eq("vehicle_id", sp.vehicle);

  const [{ data, count }, { data: vehicles }, { count: overdue }, { count: upcoming }] = await Promise.all([
    query.order("service_date", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).order("registration_number"),
    supabase.from("maintenance_records").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).in("status", ["scheduled", "in_progress"]).lt("service_date", today),
    supabase.from("maintenance_records").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).in("status", ["scheduled", "in_progress"]).gte("service_date", today).lte("service_date", new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)),
  ]);
  const canManage = can(ctx.role, "maintenance.manage");
  const filtered = !!(sp.status || sp.vehicle);

  return (
    <>
      <PageHeader title="Maintenance" description="Service schedules, repair history and costs."
        actions={canManage ? <LinkButton href="/maintenance/new"><Plus className="h-4 w-4" /> Add maintenance</LinkButton> : undefined} />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <Stat label="Overdue" value={overdue ?? 0} href="/maintenance?status=overdue" tone={overdue ? "critical" : undefined} />
        <Stat label="Due in 14 days" value={upcoming ?? 0} tone={upcoming ? "warning" : undefined} />
      </div>
      <Card>
        <FilterBar resetHref="/maintenance">
          <div className="w-44"><label htmlFor="status" className={labelClass}>Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}><option value="">All</option><option value="overdue">Overdue</option>{["scheduled", "in_progress", "completed", "cancelled"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></div>
          <div className="w-44"><label htmlFor="vehicle" className={labelClass}>Vehicle</label><select id="vehicle" name="vehicle" defaultValue={sp.vehicle ?? ""} className={inputClass}><option value="">All vehicles</option>{(vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}</select></div>
        </FilterBar>
        {(data ?? []).length === 0 ? (
          <EmptyState icon={<Wrench className="h-6 w-6" />} title={filtered ? "No records match your filters" : "No maintenance records yet"} description={filtered ? "Try resetting the filters." : "Schedule the next service so you are reminded before it is due."}
            action={!filtered && canManage ? <LinkButton href="/maintenance/new">Add maintenance</LinkButton> : undefined} />
        ) : (
          <>
            <Table><thead><tr><Th>Date</Th><Th>Vehicle</Th><Th>Type</Th><Th>Provider</Th><Th>Cost</Th><Th>Status</Th>{canManage && <Th />}</tr></thead><tbody>
              {(data ?? []).map((m) => {
                const v = (Array.isArray(m.vehicle) ? m.vehicle[0] : m.vehicle) as { id: string; registration_number: string } | null;
                const isOverdue = ["scheduled", "in_progress"].includes(m.status) && m.service_date < today;
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap">{canManage ? <Link href={`/maintenance/${m.id}`} className="text-brand hover:underline">{formatDate(m.service_date)}</Link> : formatDate(m.service_date)}</Td>
                    <Td>{v ? <Link href={`/vehicles/${v.id}`} className="hover:underline">{v.registration_number}</Link> : "-"}</Td>
                    <Td>{m.maintenance_type}{m.next_service_date && <p className="text-xs text-muted">Next: {formatDate(m.next_service_date)}</p>}</Td>
                    <Td>{m.provider ?? "-"}</Td>
                    <Td>{formatMoney(m.cost, m.currency)}</Td>
                    <Td><div className="flex gap-1.5"><Badge tone={GENERIC_TONE[m.status]}>{titleCase(m.status)}</Badge>{isOverdue && <Badge tone="red">Overdue</Badge>}</div></Td>
                    {canManage && <Td><MaintenanceRowActions id={m.id} status={m.status} /></Td>}
                  </tr>
                );
              })}
            </tbody></Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/maintenance" params={{ status: sp.status, vehicle: sp.vehicle }} />
          </>
        )}
      </Card>
    </>
  );
}
