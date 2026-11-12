import Link from "next/link";
import type { Metadata } from "next";
import { Cpu, Plus } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, FilterBar, LinkButton, Notice, PageHeader, Pagination, Table, Td, Th, inputClass, labelClass } from "@/components/ui";
import { deviceConnection } from "@/lib/device-status";
import { relativeTime } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";

export const metadata: Metadata = { title: "GPS Devices" };

export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await requireCapability("devices");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let query = supabase.from("gps_devices").select("*,vehicle:vehicles(id,registration_number)", { count: "exact" }).eq("organization_id", ctx.org.id);
  const q = sp.q?.trim().replace(/[%,()]/g, "");
  if (q) query = query.or(`imei.ilike.%${q}%,model.ilike.%${q}%,sim_msisdn.ilike.%${q}%`);
  const { data, count } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = data ?? [];

  return (
    <>
      <PageHeader title="GPS devices" description="Physical trackers. A registered device is not assumed to be online - its status comes from when it last sent data."
        actions={can(ctx.role, "devices.manage") ? <LinkButton href="/devices/new"><Plus className="h-4 w-4" /> Register device</LinkButton> : undefined} />
      {rows.some((d) => !d.vehicle_id) && <div className="mb-4"><Notice tone="amber" title="Some devices are not linked to a vehicle">Positions from unlinked devices are not stored. Link each device to a vehicle from its page.</Notice></div>}
      <Card>
        <FilterBar resetHref="/devices"><div className="w-64"><label htmlFor="q" className={labelClass}>Search</label><input id="q" name="q" defaultValue={sp.q} placeholder="IMEI, model or SIM number" className={inputClass} /></div></FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<Cpu className="h-6 w-6" />} title="No GPS devices registered" description="Register a tracker by its IMEI, then link it to a vehicle. Setup instructions for Traccar are in Settings."
            action={can(ctx.role, "devices.manage") ? <LinkButton href="/devices/new">Register device</LinkButton> : undefined} />
        ) : (
          <>
            <Table><thead><tr><Th>IMEI</Th><Th>Device</Th><Th>Vehicle</Th><Th>SIM</Th><Th>Connection</Th><Th>Last contact</Th></tr></thead><tbody>
              {rows.map((d) => {
                const v = (Array.isArray(d.vehicle) ? d.vehicle[0] : d.vehicle) as { id: string; registration_number: string } | null;
                const c = deviceConnection(d.last_communication_at, d.expected_interval_seconds, d.status);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <Td><Link href={`/devices/${d.id}`} className="font-medium text-brand hover:underline">{d.imei}</Link></Td>
                    <Td>{[d.manufacturer, d.model].filter(Boolean).join(" ") || "-"}</Td>
                    <Td>{v ? <Link href={`/vehicles/${v.id}`} className="hover:underline">{v.registration_number}</Link> : <span className="text-muted">Not linked</span>}</Td>
                    <Td>{[d.sim_operator, d.sim_msisdn].filter(Boolean).join(" ") || "-"}</Td>
                    <Td><Badge tone={c.tone}>{c.label}</Badge></Td>
                    <Td>{d.last_communication_at ? relativeTime(d.last_communication_at) : "-"}</Td>
                  </tr>
                );
              })}
            </tbody></Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/devices" params={{ q: sp.q }} />
          </>
        )}
      </Card>
    </>
  );
}
