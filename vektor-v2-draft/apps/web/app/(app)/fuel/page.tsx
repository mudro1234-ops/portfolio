import Link from "next/link";
import type { Metadata } from "next";
import { Fuel, Paperclip, Plus } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, FilterBar, LinkButton, Notice, PageHeader, Pagination, Stat, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { DeleteFuelButton } from "@/components/fuel-controls";
import { analyseFuel, type FuelRow } from "@/lib/fuel-analysis";
import { formatDate, formatMoney } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata: Metadata = { title: "Fuel & Expenses" };

export default async function FuelPage({ searchParams }: { searchParams: Promise<{ vehicle?: string; from?: string; to?: string; page?: string }> }) {
  const ctx = await requireCapability("fuel");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  let query = supabase.from("fuel_records").select("*,vehicle:vehicles(id,registration_number)", { count: "exact" }).eq("organization_id", ctx.org.id);
  let totals = supabase.from("fuel_records").select("vehicle_id,fueled_at,litres,total_cost,currency,odometer_km,id").eq("organization_id", ctx.org.id);
  if (sp.vehicle) query = query.eq("vehicle_id", sp.vehicle);
  if (sp.from) query = query.gte("fueled_at", sp.from);
  if (sp.to) query = query.lte("fueled_at", sp.to);
  if (sp.vehicle) totals = totals.eq("vehicle_id", sp.vehicle);
  if (sp.from) totals = totals.gte("fueled_at", sp.from);
  if (sp.to) totals = totals.lte("fueled_at", sp.to);

  const [{ data, count }, { data: all }, { data: vehicles }] = await Promise.all([
    query.order("fueled_at", { ascending: false }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    totals.order("fueled_at", { ascending: false }).limit(1000),
    supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).order("registration_number"),
  ]);

  const insights = analyseFuel((all ?? []) as FuelRow[]);
  const byCurrency = new Map<string, { cost: number; litres: number }>();
  (all ?? []).forEach((r) => { const c = byCurrency.get(r.currency) ?? { cost: 0, litres: 0 }; c.cost += Number(r.total_cost); c.litres += Number(r.litres); byCurrency.set(r.currency, c); });
  const unusualCount = [...insights.values()].filter((i) => i.unusual).length;

  const paths = (data ?? []).map((r) => r.receipt_path).filter(Boolean) as string[];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("receipts").createSignedUrls(paths, 3600);
    (urls ?? []).forEach((u) => { if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl); });
  }
  const canAdd = can(ctx.role, "fuel.add");
  const canManage = can(ctx.role, "fuel.manage");
  const filtered = !!(sp.vehicle || sp.from || sp.to);

  return (
    <>
      <PageHeader title="Fuel & expenses" description="Recorded fuel purchases and consumption trends."
        actions={canAdd ? <LinkButton href="/fuel/new"><Plus className="h-4 w-4" /> Record fuel</LinkButton> : undefined} />
      <div className="mb-4"><Notice tone="blue">These figures come from fuel purchases people have recorded. They are not independently verified consumption.</Notice></div>
      {(all ?? []).length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...byCurrency.entries()].map(([cur, v]) => (<Stat key={cur} label={`Total spent (${cur})`} value={formatMoney(v.cost, cur)} hint={`${v.litres.toLocaleString("en-GB", { maximumFractionDigits: 0 })} litres - ${formatMoney(v.litres ? v.cost / v.litres : 0, cur)}/L`} />))}
          <Stat label="Unusual fill-ups" value={unusualCount} tone={unusualCount ? "warning" : undefined} hint="30%+ above the vehicle's own median" />
        </div>
      )}
      <Card>
        <FilterBar resetHref="/fuel">
          <div className="w-44"><label htmlFor="vehicle" className={labelClass}>Vehicle</label><select id="vehicle" name="vehicle" defaultValue={sp.vehicle ?? ""} className={inputClass}><option value="">All vehicles</option>{(vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.registration_number}</option>)}</select></div>
          <div className="w-40"><label htmlFor="from" className={labelClass}>From</label><input id="from" type="date" name="from" defaultValue={sp.from} className={inputClass} /></div>
          <div className="w-40"><label htmlFor="to" className={labelClass}>To</label><input id="to" type="date" name="to" defaultValue={sp.to} className={inputClass} /></div>
        </FilterBar>
        {(data ?? []).length === 0 ? (
          <EmptyState icon={<Fuel className="h-6 w-6" />} title={filtered ? "No fuel records match your filters" : "No fuel records yet"} description={filtered ? "Try widening the date range." : "Record fuel purchases to track spend and consumption."}
            action={!filtered && canAdd ? <LinkButton href="/fuel/new">Record fuel</LinkButton> : undefined} />
        ) : (
          <>
            <Table><thead><tr><Th>Date</Th><Th>Vehicle</Th><Th>Litres</Th><Th>Cost</Th><Th>Odometer</Th><Th>L/100 km</Th><Th>Station</Th>{canManage && <Th />}</tr></thead><tbody>
              {(data ?? []).map((r) => {
                const v = (Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle) as { id: string; registration_number: string } | null;
                const ins = insights.get(r.id);
                const url = r.receipt_path ? signed.get(r.receipt_path) : undefined;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap">{formatDate(r.fueled_at)}</Td>
                    <Td>{v ? <Link href={`/vehicles/${v.id}`} className="text-brand hover:underline">{v.registration_number}</Link> : "-"}</Td>
                    <Td>{Number(r.litres).toLocaleString("en-GB")} L</Td>
                    <Td>{formatMoney(r.total_cost, r.currency)}</Td>
                    <Td>{r.odometer_km != null ? `${Number(r.odometer_km).toLocaleString("en-GB")} km` : "-"}</Td>
                    <Td>{ins?.l_per_100km ? <span className="flex items-center gap-2">{ins.l_per_100km.toFixed(1)}{ins.unusual && <Badge tone="amber">Unusual</Badge>}</span> : "-"}</Td>
                    <Td>{r.station ?? "-"}{url && <a href={url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center text-brand" aria-label="Open receipt"><Paperclip className="h-4 w-4" /></a>}</Td>
                    {canManage && <Td className="text-right"><DeleteFuelButton id={r.id} /></Td>}
                  </tr>
                );
              })}
            </tbody></Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/fuel" params={{ vehicle: sp.vehicle, from: sp.from, to: sp.to }} />
          </>
        )}
      </Card>
    </>
  );
}
