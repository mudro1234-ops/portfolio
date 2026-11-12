import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, FilterBar, LinkButton, PageHeader, Pagination, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { GENERIC_TONE } from "@/lib/status";
import { formatDate, titleCase } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata: Metadata = { title: "Drivers" };

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const ctx = await requireCapability("drivers");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  let query = supabase.from("drivers").select("id,full_name,phone,licence_number,licence_expiry,status,user_id", { count: "exact" }).eq("organization_id", ctx.org.id);
  const q = sp.q?.trim().replace(/[%,()]/g, "");
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,licence_number.ilike.%${q}%`);
  if (sp.status) query = query.eq("status", sp.status);
  const { data, count } = await query.order("full_name").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const ids = (data ?? []).map((d) => d.id);

  const [{ data: assignments }, { data: consent }] = await Promise.all([
    ids.length ? supabase.from("vehicle_assignments").select("driver_id,vehicle:vehicles(id,registration_number)").in("driver_id", ids).is("unassigned_at", null) : Promise.resolve({ data: [] }),
    ids.length && can(ctx.role, "drivers") ? supabase.from("driver_consent_status").select("driver_id,consented").in("driver_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const vehicleOf = new Map((assignments ?? []).map((a) => [a.driver_id, (Array.isArray(a.vehicle) ? a.vehicle[0] : a.vehicle) as { id: string; registration_number: string } | null]));
  const consentOf = new Map((consent ?? []).map((c) => [c.driver_id, c.consented]));
  const filtered = !!(q || sp.status);
  const soon = Date.now() + 30 * 86400000;

  return (
    <>
      <PageHeader title="Drivers" description="Driver records, licences and vehicle assignments."
        actions={can(ctx.role, "drivers.manage") ? <LinkButton href="/drivers/new"><Plus className="h-4 w-4" /> Add driver</LinkButton> : undefined} />
      <Card>
        <FilterBar resetHref="/drivers">
          <div className="w-56"><label htmlFor="q" className={labelClass}>Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="Name, phone or licence" className={inputClass} /></div>
          <div className="w-40"><label htmlFor="status" className={labelClass}>Status</label>
            <select id="status" name="status" defaultValue={sp.status ?? ""} className={inputClass}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
        </FilterBar>
        {(data ?? []).length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title={filtered ? "No drivers match your filters" : "No drivers yet"}
            description={filtered ? "Try a different search." : "Add drivers so you can assign vehicles and track journeys by driver."}
            action={!filtered && can(ctx.role, "drivers.manage") ? <LinkButton href="/drivers/new">Add driver</LinkButton> : undefined} />
        ) : (
          <>
            <Table>
              <thead><tr><Th>Name</Th><Th>Phone</Th><Th>Vehicle</Th><Th>Licence expiry</Th><Th>Phone tracking</Th><Th>Status</Th></tr></thead>
              <tbody>
                {(data ?? []).map((d) => {
                  const v = vehicleOf.get(d.id);
                  const expTime = d.licence_expiry ? new Date(d.licence_expiry).getTime() : null;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <Td><Link href={`/drivers/${d.id}`} className="font-medium text-brand hover:underline">{d.full_name}</Link></Td>
                      <Td>{d.phone ?? "-"}</Td>
                      <Td>{v ? <Link href={`/vehicles/${v.id}`} className="hover:underline">{v.registration_number}</Link> : <span className="text-muted">Unassigned</span>}</Td>
                      <Td>{d.licence_expiry ? <span className="flex items-center gap-2">{formatDate(d.licence_expiry)}{expTime !== null && expTime < Date.now() ? <Badge tone="red">Expired</Badge> : expTime !== null && expTime < soon ? <Badge tone="amber">Due soon</Badge> : null}</span> : "-"}</Td>
                      <Td>{!d.user_id ? <span className="text-muted">No app login</span> : consentOf.get(d.id) ? <Badge tone="green">Consented</Badge> : <Badge tone="grey">Not consented</Badge>}</Td>
                      <Td><Badge tone={GENERIC_TONE[d.status]}>{titleCase(d.status)}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/drivers" params={{ q: sp.q, status: sp.status }} />
          </>
        )}
      </Card>
    </>
  );
}
