"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Smartphone, Cpu, Route as RouteIcon, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MapCanvas } from "@/components/map-canvas";
import { vehicleMarkers } from "@/components/fleet-map";
import { Badge, StatusBadge, buttonClass, inputClass } from "@/components/ui";
import { displayStatus, type LiveStatusRow } from "@/lib/status";
import { formatDateTime, relativeTime } from "@/lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "moving", label: "Moving" },
  { id: "idle", label: "Idle" },
  { id: "stopped", label: "Stopped" },
  { id: "offline", label: "Offline / stale" },
  { id: "never_reported", label: "No data" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

function matches(v: LiveStatusRow, f: FilterId) {
  const s = displayStatus(v);
  if (f === "all") return true;
  if (f === "offline") return s === "offline" || s === "stale";
  return s === f;
}

export function LiveTracking({ orgId, timezone, initial, initialFilter }: {
  orgId: string; timezone: string; initial: LiveStatusRow[]; initialFilter?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [vehicles, setVehicles] = useState(initial);
  const [filter, setFilter] = useState<FilterId>((FILTERS.find((f) => f.id === initialFilter)?.id ?? "all") as FilterId);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeMsg, setRouteMsg] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [realtime, setRealtime] = useState<"connecting" | "on" | "off">("connecting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("vehicle_live_status").select("*").eq("organization_id", orgId);
    if (data) { setVehicles(data as LiveStatusRow[]); setLastRefresh(new Date()); }
  }, [supabase, orgId]);

  // Realtime pushes + a 30 s poll (freshness labels depend on elapsed time, not only on new data)
  useEffect(() => {
    const debounced = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refresh, 800);
    };
    const channel = supabase
      .channel(`live-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicle_current_state", filter: `organization_id=eq.${orgId}` }, debounced)
      .subscribe((status) => setRealtime(status === "SUBSCRIBED" ? "on" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "off" : "connecting"));
    const poll = setInterval(refresh, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); if (timer.current) clearTimeout(timer.current); };
  }, [supabase, orgId, refresh]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles
      .filter((v) => v.vehicle_status !== "retired")
      .filter((v) => matches(v, filter))
      .filter((v) => !q || v.registration_number.toLowerCase().includes(q) || (v.driver_name ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.registration_number.localeCompare(b.registration_number));
  }, [vehicles, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.id] = vehicles.filter((v) => v.vehicle_status !== "retired" && matches(v, f.id)).length;
    return c;
  }, [vehicles]);

  const markers = useMemo(() => vehicleMarkers(visible), [visible]);
  const selected = vehicles.find((v) => v.vehicle_id === selectedId) ?? null;

  async function showRoute(vehicleId: string) {
    setRouteMsg("Loading route...");
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase.from("vehicle_positions").select("latitude,longitude,device_time")
      .eq("vehicle_id", vehicleId).gte("device_time", since).order("device_time").limit(2000);
    if (error) { setRoute(null); setRouteMsg("Could not load the route."); return; }
    const pts = (data ?? []).map((p) => [p.longitude, p.latitude] as [number, number]);
    setRoute(pts.length > 1 ? pts : null);
    setRouteMsg(pts.length > 1 ? `Route from the last 24 hours (${pts.length} GPS points).` : "No route recorded in the last 24 hours.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="flex max-h-[calc(100vh-190px)] min-h-[420px] flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vehicle or driver" aria-label="Search vehicles" className={`${inputClass} !pl-9`} />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${filter === f.id ? "bg-navy text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}>
                {f.label} <span className="opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {visible.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">No vehicles match.</li>}
          {visible.map((v) => (
            <li key={v.vehicle_id}>
              <button onClick={() => { setSelectedId(v.vehicle_id); setRoute(null); setRouteMsg(null); }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 ${selectedId === v.vehicle_id ? "bg-brand-50" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{v.registration_number}</span>
                  <span className="block truncate text-xs text-muted">
                    {v.last_fix_at ? `Fix ${relativeTime(v.last_fix_at)}` : "No GPS data"}{v.driver_name ? ` - ${v.driver_name}` : ""}
                  </span>
                </span>
                <StatusBadge status={displayStatus(v)} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-muted">
          <span>Updated {relativeTime(lastRefresh)}</span>
          <span className="flex items-center gap-2">
            {realtime === "on" ? "Live updates on" : realtime === "off" ? "Live updates unavailable (refreshing every 30 s)" : "Connecting..."}
            <button onClick={refresh} aria-label="Refresh now" className="rounded p-1 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
          <MapCanvas markers={markers} route={route ?? undefined} height="calc(100vh - 330px)" className="min-h-[360px]"
            selectedId={selectedId} onMarkerClick={(id) => { setSelectedId(id); setRoute(null); setRouteMsg(null); }}
            fitKey={`${filter}-${markers.length}`} />
        </div>
        {selected ? (
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{selected.registration_number}</h2>
                <p className="text-sm text-muted">{[selected.make, selected.model].filter(Boolean).join(" ") || "Vehicle"}{selected.driver_name ? ` - Driver: ${selected.driver_name}` : " - No driver assigned"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => showRoute(selected.vehicle_id)} className={buttonClass("secondary", "sm")}><RouteIcon className="h-4 w-4" /> Last 24 h route</button>
                <Link href={`/vehicles/${selected.vehicle_id}`} className={buttonClass("primary", "sm")}>Vehicle details</Link>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div><dt className="text-xs text-muted">Status</dt><dd className="mt-1"><StatusBadge status={displayStatus(selected)} /></dd></div>
              <div><dt className="text-xs text-muted">Last GPS fix</dt><dd className="mt-1 text-ink">{selected.last_fix_at ? `${formatDateTime(selected.last_fix_at, timezone)} (${relativeTime(selected.last_fix_at)})` : "Never"}</dd></div>
              <div><dt className="text-xs text-muted">Speed</dt><dd className="mt-1 text-ink">{selected.connection_state === "live" && selected.speed_kmh !== null ? `${Math.round(selected.speed_kmh)} km/h` : "Unknown - position is not live"}</dd></div>
              <div><dt className="text-xs text-muted">Ignition</dt><dd className="mt-1 text-ink">{selected.ignition === null ? "Not reported" : selected.ignition ? "On" : "Off"}</dd></div>
              <div><dt className="text-xs text-muted">Tracking source</dt><dd className="mt-1 flex items-center gap-1.5 text-ink">{selected.tracking_source === "smartphone" ? <><Smartphone className="h-4 w-4" /> Smartphone</> : selected.tracking_source === "hardware" ? <><Cpu className="h-4 w-4" /> Hardware tracker</> : "No source yet"}</dd></div>
              <div><dt className="text-xs text-muted">Tracker last contact</dt><dd className="mt-1 text-ink">{selected.device_id ? relativeTime(selected.device_last_communication_at) : "No tracker linked"}</dd></div>
              <div><dt className="text-xs text-muted">Heading</dt><dd className="mt-1 text-ink">{selected.heading !== null && selected.connection_state === "live" ? `${Math.round(selected.heading)}°` : "-"}</dd></div>
              <div><dt className="text-xs text-muted">Active trip</dt><dd className="mt-1">{selected.active_trip_id ? <Link className="text-brand hover:underline" href={`/trips/${selected.active_trip_id}`}>In progress</Link> : <Badge tone="grey" dot={false}>None</Badge>}</dd></div>
            </dl>
            {selected.connection_state !== "live" && selected.connection_state !== "never_reported" && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">This is the last known position, not a live one. The vehicle may have moved since {relativeTime(selected.last_fix_at)}.</p>
            )}
            {routeMsg && <p className="mt-3 text-xs text-muted">{routeMsg}</p>}
          </div>
        ) : (
          <p className="px-1 text-sm text-muted">Select a vehicle from the list or the map to see its details.</p>
        )}
      </div>
    </div>
  );
}
