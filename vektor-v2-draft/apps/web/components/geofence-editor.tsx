"use client";
import { useMemo, useState } from "react";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/action-form";
import { Card, LinkButton, buttonClass, inputClass } from "@/components/ui";
import { MapCanvas, type MapDraft } from "@/components/map-canvas";
import { GEOFENCE_CATEGORIES } from "@/lib/constants";
import { saveGeofence } from "@/app/(app)/geofences/actions";

export interface GeofenceDefaults {
  id?: string; name?: string; category?: string; shape?: "circle" | "polygon"; center_latitude?: number | null; center_longitude?: number | null;
  radius_m?: number | null; polygon_coords?: [number, number][] | null; alert_on_entry?: boolean; alert_on_exit?: boolean; is_active?: boolean;
}

export function GeofenceEditor({ defaults = {} }: { defaults?: GeofenceDefaults }) {
  const [shape, setShape] = useState<"circle" | "polygon">(defaults.shape ?? "circle");
  const [center, setCenter] = useState<[number, number] | null>(
    defaults.center_latitude != null && defaults.center_longitude != null ? [defaults.center_longitude, defaults.center_latitude] : null);
  const [radius, setRadius] = useState<number>(defaults.radius_m ?? 300);
  const [points, setPoints] = useState<[number, number][]>(defaults.polygon_coords ?? []);
  const draft: MapDraft = useMemo(() => shape === "circle" ? { type: "circle", center: center ?? undefined, radius } : { type: "polygon", points }, [shape, center, radius, points]);

  return (
    <ActionForm action={saveGeofence} resetOnSuccess={false} className="grid gap-6 xl:grid-cols-[360px_1fr]">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="polygon" value={JSON.stringify(points)} />
      <Card className="space-y-4 p-5">
        <Field label="Name *" name="name"><Input name="name" defaultValue={defaults.name} required placeholder="e.g. Harare depot" /></Field>
        <Field label="Category" name="category"><Select name="category" required defaultValue={defaults.category ?? "depot"} options={GEOFENCE_CATEGORIES} /></Field>
        <Field label="Shape" name="shape">
          <select id="shape" name="shape" value={shape} onChange={(e) => setShape(e.target.value === "polygon" ? "polygon" : "circle")} className={inputClass}>
            <option value="circle">Circle (centre and radius)</option>
            <option value="polygon">Polygon (outline on the map)</option>
          </select>
        </Field>
        {shape === "circle" ? (
          <>
            <p className="text-xs text-muted">Click the map to place the centre, or type coordinates.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" name="center_lat"><Input name="center_lat" type="number" step="any" value={center ? center[1] : ""} onChange={(e) => setCenter([center?.[0] ?? 0, Number(e.target.value)])} /></Field>
              <Field label="Longitude" name="center_lon"><Input name="center_lon" type="number" step="any" value={center ? center[0] : ""} onChange={(e) => setCenter([Number(e.target.value), center?.[1] ?? 0])} /></Field>
            </div>
            <Field label="Radius (metres)" name="radius_m"><Input name="radius_m" type="number" min={20} max={100000} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /></Field>
          </>
        ) : (
          <Field label="Outline" name="polygon" help={`${points.length} point${points.length === 1 ? "" : "s"} placed. Click the map to add corners (at least 3).`}>
            <div className="flex gap-2">
              <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length}>Undo point</button>
              <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setPoints([])} disabled={!points.length}>Clear</button>
            </div>
          </Field>
        )}
        <fieldset className="space-y-2 border-t border-slate-100 pt-4">
          <legend className="text-xs font-medium text-ink">Alerts</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="alert_on_entry" defaultChecked={defaults.alert_on_entry ?? true} className="h-4 w-4 accent-brand" /> Alert when a vehicle enters</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="alert_on_exit" defaultChecked={defaults.alert_on_exit ?? true} className="h-4 w-4 accent-brand" /> Alert when a vehicle leaves</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={defaults.is_active ?? true} className="h-4 w-4 accent-brand" /> Geofence is active</label>
        </fieldset>
        <div className="flex gap-3 pt-2"><SubmitButton>{defaults.id ? "Save geofence" : "Create geofence"}</SubmitButton><LinkButton href="/geofences" variant="secondary">Cancel</LinkButton></div>
      </Card>
      <Card className="overflow-hidden">
        <MapCanvas height={560} draft={draft} fitKey={defaults.id ?? "new"}
          circles={[]} onMapClick={(lng, lat) => { if (shape === "circle") setCenter([lng, lat]); else setPoints((p) => [...p, [lng, lat]]); }} />
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-muted">{shape === "circle" ? "Click to set the centre of the circle." : "Click to add each corner of the area in order."} Changing a geofence re-baselines it: the next GPS fix from each vehicle is recorded without raising an alert.</p>
      </Card>
    </ActionForm>
  );
}
