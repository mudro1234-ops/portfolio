import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Route as RouteIcon } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, FilterBar, LinkButton, PageHeader, Pagination, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { GENERIC_TONE } from "@/lib/status";
import { formatDateTime, formatDuration, formatKm, titleCase } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata: Metadata = { title: "Trips" };

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ status?: string; vehicle?: string; from?: string; to?: string; page?: string }> }) {
  const ctx = await requireCapability("trips");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase.from("trips").select("id,status,origin,destination,started_at,ended_at,distance_km,source,vehicle:vehicles(id,registration_number),driver:drivers(full_name)", { count: "exact" }).eq("organization_id", ctx.org.id);
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.vehicle) query = query.eq("vehicle_id", sp.vehicle);
  if (sp.from) query = query.gte("started_at", `${sp.from}T00:00:00`);
  if (sp.to) query = query.lte("started_at", `${sp.to}T23:59:59`);
  const [{ data, count }, { data: vehicles }] = await Promise.all([
    query.order("started_at", { ascending: false, nullsFirst: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).order("registration_number"),
  ]);
  const filtered = !!(sp.status || sp.vehicle || sp.from || sp.to);

  return (
    <>
      <PageHeader title="Trips" description="Journeys recorded automatically from GPS movement, plus planned trips."
        actions={can(ctx.role, "trips.manage") ? <LinkButton href="/trips/new"><Plus className="h-4 w-4" /> Create trip</LinkButton> : undefined} />
      <Card>
        <FilterBar resetHref="/trips">
          <div className="w-40"><label htmlFor="status" className={labelClass}>Status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}><option value="">All</option>{["planned", "in_progress", "completed", "cancelled"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></div>
          <div className="w-44"><label htmlFor="vehicle" className={labelClass}>Vehicle</label><select id="vehicle" name="vehicle" defaultValue={sp.vehicle ?? ""} className={inputClass}><option value="">All vehicles</option>{(vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}</select></div>
          <div className="w-40"><label htmlFor="from" className={labelClass}>From</label><input id="from" type="date" name="from" defaultValue={sp.from} className={inputClass} /></div>
          <div className="w-40"><label htmlFor="to" className={labelClass}>To</label><input id="to" type="date" name="to" defaultValue={sp.to} className={inputClass} /></div>
        </FilterBar>
        {(data ?? []).length === 0 ? (
          <EmptyState icon={<RouteIcon className="h-6 w-6" />} title={filtered ? "No trips match your filters" : "No trips yet"}
            description={filtered ? "Try widening the date range." : "Trips appear automatically once a vehicle with a working tracker starts moving."} />
        ) : (
          <>
            <Table><thead><tr><Th>Started</Th><Th>Vehicle</Th><Th>Driver</Th><Th>Route</Th><Th>Duration</Th><Th>Distance</Th><Th>Status</Th></tr></thead><tbody>
              {(data ?? []).map((t) => {
                const v = (Array.isArray(t.vehicle) ? t.vehicle[0] : t.vehicle) as { id: string; registration_number: string } | null;
                const d = (Array.isArray(t.driver) ? t.driver[0] : t.driver) as { full_name: string } | null;
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <Td><Link href={`/trips/${t.id}`} className="text-brand hover:underline">{t.started_at ? formatDateTime(t.started_at, ctx.org.timezone) : "Not started"}</Link></Td>
                    <Td>{v?.registration_number ?? "-"}</Td>
                    <Td>{d?.full_name ?? "-"}</Td>
                    <Td className="max-w-[220px] truncate">{t.destination ? `${t.origin ?? "?"} to ${t.destination}` : t.source === "auto" ? "Automatic trip" : "-"}</Td>
                    <Td>{t.started_at ? formatDuration(t.started_at, t.ended_at) : "-"}</Td>
                    <Td>{formatKm(t.distance_km)}</Td>
                    <Td><Badge tone={GENERIC_TONE[t.status]}>{titleCase(t.status)}</Badge></Td>
                  </tr>
                );
              })}
            </tbody></Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/trips" params={{ status: sp.status, vehicle: sp.vehicle, from: sp.from, to: sp.to }} />
          </>
        )}
      </Card>
    </>
  );
}
