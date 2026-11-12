"use client";
import { useMemo } from "react";
import { MapCanvas, type MapMarker } from "@/components/map-canvas";
import { displayStatus, STATUS_META, type LiveStatusRow } from "@/lib/status";
import { relativeTime } from "@/lib/format";

export function vehicleMarkers(vehicles: LiveStatusRow[]): MapMarker[] {
  return vehicles
    .filter((v) => v.latitude !== null && v.longitude !== null && v.connection_state !== "never_reported")
    .map((v) => {
      const status = displayStatus(v);
      const meta = STATUS_META[status];
      const lines = [
        meta.label,
        v.last_fix_at ? `Last GPS fix ${relativeTime(v.last_fix_at)}` : "No GPS fix",
        v.speed_kmh !== null && v.connection_state === "live" ? `${Math.round(v.speed_kmh)} km/h` : "Speed unknown (position not live)",
      ];
      if (v.driver_name) lines.push(`Driver: ${v.driver_name}`);
      return {
        id: v.vehicle_id,
        lng: v.longitude as number,
        lat: v.latitude as number,
        color: meta.hex,
        dim: v.connection_state !== "live",
        label: `${v.registration_number} - ${meta.label}`,
        popup: { title: v.registration_number, lines },
      };
    });
}

export function FleetMap({ vehicles, height = 420, compact, selectedId, onSelect }: {
  vehicles: LiveStatusRow[]; height?: number | string; compact?: boolean; selectedId?: string | null; onSelect?: (id: string) => void;
}) {
  const markers = useMemo(() => vehicleMarkers(vehicles), [vehicles]);
  const fitKey = markers.length ? markers.map((m) => m.id).join(",") : "empty";
  return (
    <div className="relative">
      <MapCanvas markers={markers} height={height} selectedId={selectedId} onMarkerClick={onSelect} fitKey={fitKey} />
      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-white/95 px-4 py-1.5 text-xs text-muted shadow">
          No vehicle has reported a GPS position yet
        </div>
      )}
      {!compact && (
        <ul className="absolute bottom-3 left-3 hidden gap-3 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-ink shadow sm:flex">
          {(["moving", "idle", "stopped", "stale", "offline"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].hex }} aria-hidden />{STATUS_META[s].label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
