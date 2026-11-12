import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { Pencil } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { MapCanvas } from "@/components/map-canvas";
import { vehicleMarkers } from "@/components/fleet-map";
import { AssignDriverControl, LinkDeviceControl, UnlinkDeviceButton, VehicleStatusButtons } from "@/components/vehicle-controls";
import { displayStatus, GENERIC_TONE, SEVERITY_TONE, type LiveStatusRow } from "@/lib/status";
import { formatDate, formatDateTime, formatDuration, formatKm, formatMoney, relativeTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Vehicle details" };
const TABS = [
  { id: "overview", label: "Overview" }, { id: "trips", label: "Trips" }, { id: "history", label: "History" },
  { id: "maintenance", label: "Maintenance" }, { id: "fuel", label: "Fuel" }, { id: "documents", label: "Documents" }, { id: "alerts", label: "Alerts" },
];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-sm text-ink">{children}</dd></div>;
}
function expiryBadge(date: string | null) {
  if (!date) return <span className="text-muted">Not recorded</span>;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const tone = days < 0 ? "red" : days <= 30 ? "amber" : "green";
  return <span className="flex items-center gap-2">{formatDate(date)} <Badge tone={tone}>{days < 0 ? "Expired" : days <= 30 ? `${days} days left` : "Valid"}</Badge></span>;
}

export default async function VehicleDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; notice?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "overview";
  const ctx = await requireCapability("vehicles");
  const supabase = await createClient();

  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!vehicle) notFound();
  const { data: liveRow } = await supabase.from("vehicle_live_status").select("*").eq("vehicle_id", id).maybeSingle();
  const live = liveRow as LiveStatusRow | null;
  const tz = ctx.org.timezone;
  const canManage = can(ctx.role, "vehicles.manage");

  let body: React.ReactNode = null;

  if (tab === "overview") {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ data: positions }, { data: devices }, { data: freeDevices }, { data: drivers }, { data: assigned }] = await Promise.all([
      supabase.from("vehicle_positions").select("latitude,longitude").eq("vehicle_id", id).gte("device_time", since).order("device_time").limit(1500),
      supabase.from("gps_devices").select("*").eq("vehicle_id", id),
      supabase.from("gps_devices").select("id,imei,model,manufacturer").eq("organization_id", ctx.org.id).is("vehicle_id", null).eq("status", "active"),
      supabase.from("drivers").select("id,full_name").eq("organization_id", ctx.org.id).eq("status", "active").order("full_name"),
      supabase.from("vehicle_assignments").select("driver_id").eq("organization_id", ctx.org.id).is("unassigned_at", null),
    ]);
    const taken = new Set((assigned ?? []).map((a) => a.driver_id));
    const route = (positions ?? []).map((p) => [p.longitude, p.latitude] as [number, number]);
    const markers = live ? vehicleMarkers([live]) : [];
    const stale = live && live.connection_state !== "live";
    body = (
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Location" description={live?.last_fix_at ? `Last GPS fix ${formatDateTime(live.last_fix_at, tz)} (${relativeTime(live.last_fix_at)})` : "No GPS position received yet"} />
            <MapCanvas markers={markers} route={route.length > 1 ? route : undefined} height={340} fitKey={`${id}-${markers.length}-${route.length}`} />
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-muted">
              {route.length > 1 ? `Blue line: route from the last 24 hours (${route.length} GPS points).` : "No route recorded in the last 24 hours."}
              {stale && <span className="ml-1 font-medium text-amber-700">This is the last known position, not a live one.</span>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Vehicle details" />
            <dl className="grid grid-cols-2 gap-5 p-5 md:grid-cols-3">
              <Fact label="Make / model">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "-"}</Fact>
              <Fact label="Type">{titleCase(vehicle.category)}</Fact>
              <Fact label="Year">{vehicle.year ?? "-"}</Fact>
              <Fact label="Colour">{vehicle.colour ?? "-"}</Fact>
              <Fact label="VIN / chassis">{vehicle.vin ?? "-"}</Fact>
              <Fact label="Fuel type">{titleCase(vehicle.fuel_type)}</Fact>
              <Fact label="Odometer">{formatKm(vehicle.odometer_km, 0)}</Fact>
              <Fact label="Speed limit">{vehicle.speed_limit_kmh ? `${vehicle.speed_limit_kmh} km/h` : "Not set"}</Fact>
              <Fact label="Registered">{formatDate(vehicle.registered_at)}</Fact>
            </dl>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Live status" />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Fact label="Status">{live ? <StatusBadge status={displayStatus(live)} /> : "-"}</Fact>
              <Fact label="Speed">{live?.connection_state === "live" && live.speed_kmh !== null ? `${Math.round(live.speed_kmh)} km/h` : "Unknown"}</Fact>
              <Fact label="Ignition">{live?.ignition === null || live?.ignition === undefined ? "Not reported" : live.ignition ? "On" : "Off"}</Fact>
              <Fact label="Source">{live?.tracking_source ? titleCase(live.tracking_source) : "None yet"}</Fact>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Assigned driver" />
            <div className="p-5"><AssignDriverControl vehicleId={id} canEdit={can(ctx.role, "drivers.manage") || can(ctx.role, "trips.manage")}
              current={live?.driver_id ? { id: live.driver_id, name: live.driver_name ?? "Driver" } : null}
              options={(drivers ?? []).filter((d) => !taken.has(d.id) || d.id === live?.driver_id).map((d) => ({ value: d.id, label: d.full_name }))} /></div>
          </Card>
          <Card>
            <CardHeader title="GPS tracker" />
            <div className="space-y-4 p-5">
              {(devices ?? []).length === 0 && <p className="text-sm text-muted">No tracker linked. Without one (or a consenting driver phone) this vehicle will not appear on the map.</p>}
              {(devices ?? []).map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-medium text-ink">{[d.manufacturer, d.model].filter(Boolean).join(" ") || "GPS device"}</p><p className="text-xs text-muted">IMEI {d.imei}{d.protocol ? ` - ${d.protocol}` : ""}</p></div>
                    {canManage && <UnlinkDeviceButton deviceId={d.id} vehicleId={id} />}
                  </div>
                  <p className="mt-2 text-xs text-muted">Last contact: {d.last_communication_at ? `${formatDateTime(d.last_communication_at, tz)} (${relativeTime(d.last_communication_at)})` : "never"}</p>
                </div>
              ))}
              <LinkDeviceControl vehicleId={id} canEdit={can(ctx.role, "devices.manage")}
                options={(freeDevices ?? []).map((d) => ({ value: d.id, label: `${d.imei}${d.model ? ` - ${d.model}` : ""}` }))} />
            </div>
          </Card>
          {canManage && <Card><CardHeader title="Vehicle lifecycle" /><div className="p-5"><VehicleStatusButtons vehicleId={id} status={vehicle.status} /></div></Card>}
        </div>
      </div>
    );
  } else if (tab === "trips") {
    const { data: trips } = await supabase.from("trips").select("id,status,started_at,ended_at,distance_km,source,driver:drivers(full_name)").eq("vehicle_id", id).order("started_at", { ascending: false, nullsFirst: false }).limit(50);
    body = (
      <Card>{(trips ?? []).length === 0 ? <EmptyState title="No trips yet" description="Trips are created automatically when the vehicle starts moving." /> : (
        <Table><thead><tr><Th>Started</Th><Th>Duration</Th><Th>Distance</Th><Th>Driver</Th><Th>Status</Th></tr></thead><tbody>
          {(trips ?? []).map((t) => { const d = (Array.isArray(t.driver) ? t.driver[0] : t.driver) as { full_name: string } | null; return (
            <tr key={t.id} className="hover:bg-slate-50"><Td><Link className="text-brand hover:underline" href={`/trips/${t.id}`}>{formatDateTime(t.started_at, tz)}</Link></Td><Td>{formatDuration(t.started_at, t.ended_at)}</Td><Td>{formatKm(t.distance_km)}</Td><Td>{d?.full_name ?? "-"}</Td><Td><Badge tone={GENERIC_TONE[t.status]}>{titleCase(t.status)}</Badge></Td></tr>); })}
        </tbody></Table>)}</Card>
    );
  } else if (tab === "history") {
    const [{ data: assignments }, { data: logs }] = await Promise.all([
      supabase.from("vehicle_assignments").select("id,assigned_at,unassigned_at,driver:drivers(full_name)").eq("vehicle_id", id).order("assigned_at", { ascending: false }).limit(30),
      can(ctx.role, "audit") ? supabase.from("audit_logs").select("id,action,entity,created_at,details").eq("organization_id", ctx.org.id).eq("entity_id", id).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] as { id: number; action: string; entity: string; created_at: string; details: unknown }[] }),
    ]);
    body = (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Driver assignments" />{(assignments ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No assignments yet.</p> : (
          <ul className="divide-y divide-slate-100">{(assignments ?? []).map((a) => { const d = (Array.isArray(a.driver) ? a.driver[0] : a.driver) as { full_name: string } | null; return (
            <li key={a.id} className="px-5 py-3 text-sm"><p className="font-medium text-ink">{d?.full_name ?? "Driver"}</p><p className="text-xs text-muted">{formatDateTime(a.assigned_at, tz)} to {a.unassigned_at ? formatDateTime(a.unassigned_at, tz) : "present"}</p></li>); })}</ul>)}</Card>
        <Card><CardHeader title="Record changes" description="Visible to owners and administrators" />{(logs ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No changes to show.</p> : (
          <ul className="divide-y divide-slate-100">{(logs ?? []).map((l) => (<li key={l.id} className="px-5 py-3 text-sm"><p className="text-ink">{titleCase(l.action)}d {l.entity.replace(/_/g, " ")}</p><p className="text-xs text-muted">{formatDateTime(l.created_at, tz)}</p></li>))}</ul>)}</Card>
      </div>
    );
  } else if (tab === "maintenance") {
    const { data: recs } = await supabase.from("maintenance_records").select("*").eq("vehicle_id", id).order("service_date", { ascending: false }).limit(50);
    body = (<Card>{(recs ?? []).length === 0 ? <EmptyState title="No maintenance records" action={can(ctx.role, "maintenance.manage") ? <LinkButton href="/maintenance/new">Add maintenance</LinkButton> : undefined} /> : (
      <Table><thead><tr><Th>Date</Th><Th>Type</Th><Th>Provider</Th><Th>Cost</Th><Th>Status</Th></tr></thead><tbody>
        {(recs ?? []).map((m) => <tr key={m.id}><Td>{formatDate(m.service_date)}</Td><Td>{m.maintenance_type}</Td><Td>{m.provider ?? "-"}</Td><Td>{formatMoney(m.cost, m.currency)}</Td><Td><Badge tone={GENERIC_TONE[m.status]}>{titleCase(m.status)}</Badge></Td></tr>)}
      </tbody></Table>)}</Card>);
  } else if (tab === "fuel") {
    const { data: fuel } = await supabase.from("fuel_records").select("*").eq("vehicle_id", id).order("fueled_at", { ascending: false }).limit(50);
    body = (<Card>{(fuel ?? []).length === 0 ? <EmptyState title="No fuel records" action={can(ctx.role, "fuel.add") ? <LinkButton href="/fuel/new">Record fuel</LinkButton> : undefined} /> : (
      <Table><thead><tr><Th>Date</Th><Th>Litres</Th><Th>Cost</Th><Th>Odometer</Th><Th>Station</Th></tr></thead><tbody>
        {(fuel ?? []).map((f) => <tr key={f.id}><Td>{formatDate(f.fueled_at)}</Td><Td>{Number(f.litres).toLocaleString()} L</Td><Td>{formatMoney(f.total_cost, f.currency)}</Td><Td>{formatKm(f.odometer_km, 0)}</Td><Td>{f.station ?? "-"}</Td></tr>)}
      </tbody></Table>)}</Card>);
  } else if (tab === "documents") {
    body = (<Card><CardHeader title="Compliance documents" description="Expiry dates are tracked. Uploading document files is not available yet." />
      <dl className="grid gap-5 p-5 sm:grid-cols-2"><Fact label="Insurance expiry">{expiryBadge(vehicle.insurance_expiry)}</Fact><Fact label="Licence expiry">{expiryBadge(vehicle.licence_expiry)}</Fact></dl>
      {canManage && <div className="border-t border-slate-100 px-5 py-3"><LinkButton href={`/vehicles/${id}/edit`} variant="secondary" size="sm">Update dates</LinkButton></div>}</Card>);
  } else if (tab === "alerts") {
    const { data: alerts } = await supabase.from("alerts").select("id,title,severity,status,created_at,type").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(50);
    body = (<Card>{(alerts ?? []).length === 0 ? <EmptyState title="No alerts for this vehicle" /> : (
      <Table><thead><tr><Th>When</Th><Th>Alert</Th><Th>Severity</Th><Th>Status</Th></tr></thead><tbody>
        {(alerts ?? []).map((a) => <tr key={a.id}><Td>{formatDateTime(a.created_at, tz)}</Td><Td>{a.title}</Td><Td><Badge tone={SEVERITY_TONE[a.severity]}>{titleCase(a.severity)}</Badge></Td><Td><Badge tone={GENERIC_TONE[a.status]}>{titleCase(a.status)}</Badge></Td></tr>)}
      </tbody></Table>)}</Card>);
  }

  return (
    <>
      {sp.notice && <div className="mb-4"><Notice tone="amber">{sp.notice}</Notice></div>}
      <PageHeader
        title={vehicle.registration_number}
        description={[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "Vehicle"}
        actions={<>{live && <StatusBadge status={displayStatus(live)} />}{canManage && <LinkButton href={`/vehicles/${id}/edit`} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> Edit</LinkButton>}</>}
      />
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Vehicle sections">
        {TABS.map((t) => (
          <Link key={t.id} href={`/vehicles/${id}?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
            className={clsx("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium", tab === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink")}>{t.label}</Link>
        ))}
      </nav>
      {body}
    </>
  );
}
