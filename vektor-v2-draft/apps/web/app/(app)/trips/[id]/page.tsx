import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { TripActionButtons, TripNotesForm } from "@/components/trip-controls";
import { TripPlayback, type PlaybackPoint } from "@/components/trip-playback";
import { GENERIC_TONE } from "@/lib/status";
import { formatDateTime, formatDuration, formatKm, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Trip" };

interface Stop { from: string; to: string; lat: number; lng: number }

/** A stop is 3+ minutes below 3 km/h. */
function findStops(points: PlaybackPoint[]): Stop[] {
  const stops: Stop[] = [];
  let start: PlaybackPoint | null = null;
  let last: PlaybackPoint | null = null;
  const flush = () => {
    if (start && last && new Date(last.t).getTime() - new Date(start.t).getTime() >= 3 * 60000) {
      stops.push({ from: start.t, to: last.t, lat: start.lat, lng: start.lng });
    }
    start = null;
  };
  for (const p of points) {
    if ((p.speed ?? 0) < 3) { if (!start) start = p; last = p; } else { flush(); }
  }
  flush();
  return stops;
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCapability("trips");
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("*,vehicle:vehicles(id,registration_number),driver:drivers(id,full_name)").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!trip) notFound();
  const vehicle = (Array.isArray(trip.vehicle) ? trip.vehicle[0] : trip.vehicle) as { id: string; registration_number: string } | null;
  const driver = (Array.isArray(trip.driver) ? trip.driver[0] : trip.driver) as { id: string; full_name: string } | null;

  let points: PlaybackPoint[] = [];
  if (trip.started_at) {
    const { data } = await supabase.from("vehicle_positions").select("latitude,longitude,device_time,speed_kmh")
      .eq("vehicle_id", trip.vehicle_id).gte("device_time", trip.started_at).lte("device_time", trip.ended_at ?? new Date().toISOString())
      .order("device_time").limit(3000);
    points = (data ?? []).map((p) => ({ lng: p.longitude, lat: p.latitude, t: p.device_time, speed: p.speed_kmh }));
  }
  const stops = findStops(points);
  const speeds = points.map((p) => p.speed ?? 0);
  const maxSpeed = speeds.length ? Math.max(...speeds) : null;
  const tz = ctx.org.timezone;
  const canManage = can(ctx.role, "trips.manage");

  return (
    <>
      <PageHeader title={trip.destination ? `Trip to ${trip.destination}` : "Trip"} description={`${vehicle?.registration_number ?? "Vehicle"}${driver ? ` - ${driver.full_name}` : ""}`}
        actions={<><Badge tone={GENERIC_TONE[trip.status]}>{titleCase(trip.status)}</Badge>{canManage && <TripActionButtons id={id} status={trip.status} />}</>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Distance" value={formatKm(trip.distance_km)} hint={trip.source === "auto" ? "Calculated from GPS" : "From GPS while in progress"} />
        <Stat label="Duration" value={trip.started_at ? formatDuration(trip.started_at, trip.ended_at) : "-"} />
        <Stat label="Top speed" value={maxSpeed !== null ? `${Math.round(maxSpeed)} km/h` : "-"} hint="From recorded GPS points" />
        <Stat label="Stops (3+ min)" value={stops.length} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader title="Route playback" description={points.length ? `${points.length} GPS points` : undefined} /><TripPlayback points={points} timezone={tz} /></Card>
        <div className="space-y-6">
          <Card><CardHeader title="Trip details" /><dl className="space-y-3 p-5 text-sm">
            <div><dt className="text-xs text-muted">Vehicle</dt><dd>{vehicle ? <Link className="text-brand hover:underline" href={`/vehicles/${vehicle.id}`}>{vehicle.registration_number}</Link> : "-"}</dd></div>
            <div><dt className="text-xs text-muted">Driver</dt><dd>{driver ? <Link className="text-brand hover:underline" href={`/drivers/${driver.id}`}>{driver.full_name}</Link> : "Not recorded"}</dd></div>
            <div><dt className="text-xs text-muted">Started</dt><dd>{formatDateTime(trip.started_at, tz)}</dd></div>
            <div><dt className="text-xs text-muted">Ended</dt><dd>{trip.ended_at ? formatDateTime(trip.ended_at, tz) : trip.status === "in_progress" ? "Still in progress" : "-"}</dd></div>
            {trip.origin && <div><dt className="text-xs text-muted">Origin</dt><dd>{trip.origin}</dd></div>}
            <div><dt className="text-xs text-muted">Recorded by</dt><dd>{trip.source === "auto" ? "Automatic GPS detection" : "Created manually"}</dd></div>
          </dl></Card>
          <Card><CardHeader title="Stops" />{stops.length === 0 ? <p className="px-5 py-6 text-center text-sm text-muted">No stops of 3 minutes or more.</p> : (
            <ul className="divide-y divide-slate-100">{stops.map((s, i) => (<li key={i} className="px-5 py-3 text-sm"><p className="text-ink">{formatDuration(s.from, s.to)}</p><p className="text-xs text-muted">{formatDateTime(s.from, tz)}</p></li>))}</ul>)}</Card>
          <Card><CardHeader title="Notes" /><div className="p-5"><TripNotesForm id={id} notes={trip.notes} canEdit={canManage} /></div></Card>
        </div>
      </div>
    </>
  );
}
