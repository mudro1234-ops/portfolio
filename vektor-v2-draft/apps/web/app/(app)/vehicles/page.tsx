import Link from "next/link";
import type { Metadata } from "next";
import { Truck, Plus } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Card, EmptyState, FilterBar, LinkButton, PageHeader, Pagination, StatusBadge, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { displayStatus, type LiveStatusRow } from "@/lib/status";
import { relativeTime, titleCase } from "@/lib/format";
import { PAGE_SIZE, VEHICLE_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Vehicles" };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const ctx = await requireCapability("vehicles");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  let query = supabase.from("vehicle_live_status").select("*", { count: "exact" }).eq("organization_id", ctx.org.id);
  const q = sp.q?.trim().replace(/[%,()]/g, "");
  if (q) query = query.ilike("registration_number", `%${q}%`);
  if (sp.status) query = query.eq("vehicle_status", sp.status);
  else query = query.neq("vehicle_status", "retired");
  const { data, count, error } = await query.order("registration_number").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as LiveStatusRow[];
  const filtered = !!(q || sp.status);

  return (
    <>
      <PageHeader title="Vehicles" description="Your registered fleet, with live status and assigned drivers."
        actions={can(ctx.role, "vehicles.manage") ? <LinkButton href="/vehicles/new"><Plus className="h-4 w-4" /> Add vehicle</LinkButton> : undefined} />
      <Card>
        <FilterBar resetHref="/vehicles">
          <div className="w-56"><label htmlFor="q" className={labelClass}>Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Registration number" className={inputClass} /></div>
          <div className="w-44"><label htmlFor="status" className={labelClass}>Status</label>
            <select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}>
              <option value="">All (not retired)</option>
              {VEHICLE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select></div>
        </FilterBar>
        {error ? (
          <EmptyState title="Vehicles could not be loaded" description="Refresh the page to try again." />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Truck className="h-6 w-6" />} title={filtered ? "No vehicles match your filters" : "No vehicles yet"}
            description={filtered ? "Try a different search or reset the filters." : "Add your first vehicle to start tracking your fleet."}
            action={!filtered && can(ctx.role, "vehicles.manage") ? <LinkButton href="/vehicles/new">Add vehicle</LinkButton> : undefined} />
        ) : (
          <>
            <Table>
              <thead><tr><Th>Registration</Th><Th>Vehicle</Th><Th>Status</Th><Th>Driver</Th><Th>Last GPS fix</Th></tr></thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.vehicle_id} className="hover:bg-slate-50">
                    <Td><Link href={`/vehicles/${v.vehicle_id}`} className="font-medium text-brand hover:underline">{v.registration_number}</Link></Td>
                    <Td>{[v.make, v.model].filter(Boolean).join(" ") || "-"}</Td>
                    <Td><StatusBadge status={displayStatus(v)} /></Td>
                    <Td>{v.driver_name ?? <span className="text-muted">Unassigned</span>}</Td>
                    <Td>{v.last_fix_at ? relativeTime(v.last_fix_at) : <span className="text-muted">No GPS data</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/vehicles" params={{ q: sp.q, status: sp.status }} />
          </>
        )}
      </Card>
      {sp.status && <p className="mt-3 text-xs text-muted">Showing {titleCase(sp.status)} vehicles.</p>}
    </>
  );
}
