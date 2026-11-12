import Link from "next/link";
import type { Metadata } from "next";
import { Truck, UserPlus, Route as RouteIcon, MapPin, Bell, Wrench, ArrowRight } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat, StatusBadge, Badge, Notice } from "@/components/ui";
import { displayStatus, SEVERITY_TONE, type LiveStatusRow } from "@/lib/status";
import { formatDateTime, formatKm, formatMoney, relativeTime, formatDuration, titleCase } from "@/lib/format";
import { FleetMap } from "@/components/fleet-map";

export const metadata: Metadata = { title: "Overview" };

interface Summary {
  total_vehicles: number; active_vehicles: number; inactive_vehicles: number; moving: number; idle: number;
  stopped: number; stale: number; offline: number; never_reported: number; active_trips: number;
  total_drivers: number; open_alerts: number; critical_alerts: number; maintenance_due: number;
  distance_30d_km: number; trips_30d: number; completed_trips_30d: number;
  fuel_30d: { currency: string; total: number; litres: number }[];
  maintenance_30d: { currency: string; total: number }[];
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await requireCapability("overview");
  const sp = await searchParams;
  const supabase = await createClient();

  const [summaryRes, liveRes, alertsRes, tripsRes, maintRes] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_org: ctx.org.id }),
    supabase.from("vehicle_live_status").select("*").eq("organization_id", ctx.org.id),
    supabase.from("alerts").select("id,title,severity,status,created_at,type").eq("organization_id", ctx.org.id)
      .neq("status", "resolved").order("created_at", { ascending: false }).limit(6),
    supabase.from("trips").select("id,status,started_at,ended_at,distance_km,vehicle:vehicles(registration_number),driver:drivers(full_name)")
      .eq("organization_id", ctx.org.id).order("started_at", { ascending: false, nullsFirst: false }).limit(5),
    supabase.from("maintenance_records").select("id,maintenance_type,service_date,status,vehicle:vehicles(registration_number)")
      .eq("organization_id", ctx.org.id).in("status", ["scheduled", "in_progress"])
      .order("service_date").limit(5),
  ]);

  const s = (summaryRes.data ?? {}) as Summary;
  const live = (liveRes.data ?? []) as LiveStatusRow[];
  const attention = live.filter((v) => v.vehicle_status === "active" && (v.connection_state === "offline" || v.connection_state === "stale" || v.connection_state === "never_reported"));
  const loadError = summaryRes.error || liveRes.error;
  const canAddFleet = can(ctx.role, "vehicles.manage");
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ctx.org.timezone }).format(new Date());
  const completionRate = s.trips_30d > 0 ? Math.round((s.completed_trips_30d / s.trips_30d) * 100) : null;
  const trackable = (s.total_vehicles ?? 0) - (s.never_reported ?? 0);
  const utilisation = trackable > 0 ? Math.round((((s.moving ?? 0) + (s.idle ?? 0)) / trackable) * 100) : null;

  return (
    <>
      <PageHeader
        title={sp.welcome ? `Welcome to ${ctx.org.name}` : `Welcome back, ${ctx.fullName.split(" ")[0]}`}
        description={`${ctx.org.name} - ${today}`}
        actions={canAddFleet ? (
          <>
            <LinkButton href="/vehicles/new" size="sm"><Truck className="h-4 w-4" /> Add vehicle</LinkButton>
            <LinkButton href="/drivers/new" size="sm" variant="secondary"><UserPlus className="h-4 w-4" /> Add driver</LinkButton>
            {can(ctx.role, "trips.manage") && <LinkButton href="/trips/new" size="sm" variant="secondary"><RouteIcon className="h-4 w-4" /> Create trip</LinkButton>}
          </>
        ) : undefined}
      />

      {loadError && <div className="mb-4"><Notice tone="red" title="Some figures could not be loaded">Refresh the page. If this continues, check the database connection and migrations.</Notice></div>}

      {(s.total_vehicles ?? 0) === 0 ? (
        <Card>
          <EmptyState icon={<Truck className="h-6 w-6" />} title="Add your first vehicle"
            description="Your workspace is ready. Register a vehicle, then link a GPS tracker or driver phone to see it on the map. Nothing on this page is sample data - it will fill with your real fleet activity."
            action={canAddFleet ? <LinkButton href="/vehicles/new">Add vehicle</LinkButton> : undefined} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Total vehicles" value={s.total_vehicles} href="/vehicles" hint={`${s.active_vehicles} active`} />
            <Stat label="Moving" value={s.moving} href="/live?state=moving" tone="success" />
            <Stat label="Idle" value={s.idle} href="/live?state=idle" tone={s.idle ? "warning" : undefined} />
            <Stat label="Offline" value={(s.offline ?? 0) + (s.stale ?? 0)} href="/live?state=offline" tone={(s.offline ?? 0) > 0 ? "critical" : undefined}
              hint={`${s.stale} stale - ${s.offline} offline${s.never_reported ? ` - ${s.never_reported} no data` : ""}`} />
            <Stat label="Active trips" value={s.active_trips} href="/trips?status=in_progress" />
            <Stat label="Open alerts" value={s.open_alerts} href="/alerts?status=open" tone={s.critical_alerts ? "critical" : undefined}
              hint={s.critical_alerts ? `${s.critical_alerts} critical` : undefined} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Fleet activity" description="Latest valid positions. Stale and offline vehicles are marked." action={<Link href="/live" className="text-xs font-medium text-brand hover:underline">Open live tracking</Link>} />
              <FleetMap vehicles={live} height={380} compact />
            </Card>
            <Card>
              <CardHeader title="Needs attention" description="Vehicles not reporting" />
              {attention.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">Every active vehicle is reporting.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {attention.slice(0, 7).map((v) => (
                    <li key={v.vehicle_id}>
                      <Link href={`/vehicles/${v.vehicle_id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{v.registration_number}</p>
                          <p className="text-xs text-muted">{v.last_fix_at ? `Last fix ${relativeTime(v.last_fix_at)}` : "No GPS data received"}</p>
                        </div>
                        <StatusBadge status={displayStatus(v)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Recent alerts" action={<Link href="/alerts" className="text-xs font-medium text-brand hover:underline">View all</Link>} />
              {(alertsRes.data ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No open alerts.</p> : (
                <ul className="divide-y divide-slate-100">
                  {(alertsRes.data ?? []).map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{a.title}</p>
                        <p className="text-xs text-muted">{relativeTime(a.created_at)}</p>
                      </div>
                      <Badge tone={SEVERITY_TONE[a.severity]}>{titleCase(a.severity)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Recent trips" action={<Link href="/trips" className="text-xs font-medium text-brand hover:underline">View all</Link>} />
              {(tripsRes.data ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No trips recorded yet. Trips are created automatically from GPS movement.</p> : (
                <ul className="divide-y divide-slate-100">
                  {(tripsRes.data ?? []).map((t) => {
                    const vehicle = (Array.isArray(t.vehicle) ? t.vehicle[0] : t.vehicle) as { registration_number: string } | null;
                    return (
                      <li key={t.id}>
                        <Link href={`/trips/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{vehicle?.registration_number ?? "Vehicle"}</p>
                            <p className="text-xs text-muted">{formatDateTime(t.started_at, ctx.org.timezone)} - {formatDuration(t.started_at, t.ended_at)}</p>
                          </div>
                          <span className="text-sm text-ink">{formatKm(t.distance_km)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Maintenance due soon" action={<Link href="/maintenance" className="text-xs font-medium text-brand hover:underline">View all</Link>} />
              {(maintRes.data ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nothing scheduled.</p> : (
                <ul className="divide-y divide-slate-100">
                  {(maintRes.data ?? []).map((m) => {
                    const vehicle = (Array.isArray(m.vehicle) ? m.vehicle[0] : m.vehicle) as { registration_number: string } | null;
                    const overdue = new Date(m.service_date) < new Date(new Date().toDateString());
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                        <Wrench className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">{vehicle?.registration_number} - {m.maintenance_type}</p>
                          <p className="text-xs text-muted">{m.service_date}</p>
                        </div>
                        {overdue && <Badge tone="red">Overdue</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Last 30 days</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="Distance travelled" value={formatKm(s.distance_30d_km, 0)} hint={`${s.trips_30d} trips`} />
            <Stat label="Vehicle utilisation" value={utilisation === null ? "-" : `${utilisation}%`} hint="Moving or idle right now, of reporting vehicles" />
            <Stat label="Trip completion" value={completionRate === null ? "-" : `${completionRate}%`} />
            <Stat label="Fuel spend" value={(s.fuel_30d ?? []).length ? (s.fuel_30d ?? []).map((f) => formatMoney(f.total, f.currency)).join(" + ") : "-"} hint="Recorded purchases" href="/fuel" />
            <Stat label="Maintenance spend" value={(s.maintenance_30d ?? []).length ? (s.maintenance_30d ?? []).map((f) => formatMoney(f.total, f.currency)).join(" + ") : "-"} hint="Completed services" href="/maintenance" />
          </div>
          <p className="mt-6 flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" aria-hidden /> All figures come from your organisation&apos;s own records. <Link href="/reports" className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline">Reports <ArrowRight className="h-3 w-3" /></Link></p>
        </>
      )}
    </>
  );
}
