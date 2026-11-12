import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deviceConnection } from "@/lib/device-status";
import { titleCase } from "@/lib/format";

export const REPORT_TYPES = [
  { id: "utilisation", label: "Vehicle utilisation", description: "How much each vehicle was used in the period." },
  { id: "trips", label: "Trip history", description: "Every trip in the period." },
  { id: "distance", label: "Distance travelled", description: "Distance and trip counts by vehicle." },
  { id: "drivers", label: "Driver activity", description: "Trips, distance and speeding alerts by driver." },
  { id: "fuel", label: "Fuel expenses", description: "Recorded fuel spend by vehicle, with cost per km where distance is known." },
  { id: "maintenance", label: "Maintenance expenses", description: "Maintenance records and costs." },
  { id: "alerts", label: "Alert history", description: "Alerts raised in the period." },
  { id: "availability", label: "Vehicle availability", description: "Current status, driver and open maintenance per vehicle." },
  { id: "connectivity", label: "Device connectivity", description: "Tracker connection health and last contact." },
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]["id"];

export interface ReportFilters { from: string; to: string; vehicle?: string; driver?: string }
export interface ReportResult {
  columns: string[];
  rows: (string | number)[][];
  summary: { label: string; value: string }[];
  note?: string;
  truncated?: boolean;
}

const LIMIT = 5000;
type Row = Record<string, unknown>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const hours = (a: string | null, b: string | null) => (a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000) : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const fmtDT = (v: unknown, tz: string) => v ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(String(v))) : "";

export function isReportType(v: string | undefined): v is ReportType { return !!REPORT_TYPES.find((t) => t.id === v); }
export function defaultRange() {
  const to = new Date(); const from = new Date(Date.now() - 29 * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
const validDate = (v: string | undefined, fb: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fb);

export async function runReport(supabase: SupabaseClient, orgId: string, type: ReportType, raw: Partial<ReportFilters>, tz: string): Promise<ReportResult> {
  const def = defaultRange();
  const f: ReportFilters = { from: validDate(raw.from, def.from), to: validDate(raw.to, def.to), vehicle: raw.vehicle, driver: raw.driver };
  const fromTs = `${f.from}T00:00:00`; const toTs = `${f.to}T23:59:59`;
  const days = Math.max(1, Math.round((new Date(f.to).getTime() - new Date(f.from).getTime()) / 86400000) + 1);

  const vehiclesRes = await supabase.from("vehicles").select("id,registration_number,status,make,model").eq("organization_id", orgId).limit(LIMIT);
  const vehicles = (vehiclesRes.data ?? []) as Row[];
  const vname = new Map(vehicles.map((v) => [String(v.id), String(v.registration_number)]));
  const scopedVehicles = f.vehicle ? vehicles.filter((v) => v.id === f.vehicle) : vehicles;

  const tripsQuery = () => {
    let q = supabase.from("trips").select("id,vehicle_id,driver_id,status,started_at,ended_at,distance_km,origin,destination,driver:drivers(full_name)").eq("organization_id", orgId)
      .not("started_at", "is", null).gte("started_at", fromTs).lte("started_at", toTs).neq("status", "cancelled");
    if (f.vehicle) q = q.eq("vehicle_id", f.vehicle);
    if (f.driver) q = q.eq("driver_id", f.driver);
    return q.order("started_at", { ascending: false }).limit(LIMIT);
  };

  switch (type) {
    case "trips": {
      const { data } = await tripsQuery();
      const rows = (data ?? []) as Row[];
      const total = rows.reduce((s, t) => s + Number(t.distance_km), 0);
      return {
        columns: ["Started", "Ended", "Vehicle", "Driver", "Origin", "Destination", "Distance (km)", "Duration (h)", "Status"],
        rows: rows.map((t) => [fmtDT(t.started_at, tz), fmtDT(t.ended_at, tz), vname.get(String(t.vehicle_id)) ?? "", one(t.driver as Row | Row[] | null)?.full_name as string ?? "", String(t.origin ?? ""), String(t.destination ?? ""), r1(Number(t.distance_km)), r2(hours(String(t.started_at), t.ended_at ? String(t.ended_at) : null)), titleCase(String(t.status))]),
        summary: [{ label: "Trips", value: String(rows.length) }, { label: "Total distance", value: `${r1(total).toLocaleString("en-GB")} km` }],
        truncated: rows.length >= LIMIT,
      };
    }
    case "distance":
    case "utilisation": {
      const { data } = await tripsQuery();
      const trips = (data ?? []) as Row[];
      const agg = new Map<string, { trips: number; km: number; h: number; longest: number; days: Set<string> }>();
      trips.forEach((t) => {
        const a = agg.get(String(t.vehicle_id)) ?? { trips: 0, km: 0, h: 0, longest: 0, days: new Set<string>() };
        a.trips++; a.km += Number(t.distance_km); a.h += hours(String(t.started_at), t.ended_at ? String(t.ended_at) : null);
        a.longest = Math.max(a.longest, Number(t.distance_km)); a.days.add(String(t.started_at).slice(0, 10)); agg.set(String(t.vehicle_id), a);
      });
      const rows = scopedVehicles.filter((v) => v.status !== "retired").map((v) => ({ v, a: agg.get(String(v.id)) ?? { trips: 0, km: 0, h: 0, longest: 0, days: new Set<string>() } }));
      const totalKm = rows.reduce((s, r) => s + r.a.km, 0);
      const idle = rows.filter((r) => r.a.trips === 0).length;
      if (type === "distance") {
        return {
          columns: ["Vehicle", "Trips", "Distance (km)", "Average trip (km)", "Longest trip (km)"],
          rows: rows.sort((x, y) => y.a.km - x.a.km).map(({ v, a }) => [String(v.registration_number), a.trips, r1(a.km), a.trips ? r1(a.km / a.trips) : 0, r1(a.longest)]),
          summary: [{ label: "Total distance", value: `${r1(totalKm).toLocaleString("en-GB")} km` }, { label: "Vehicles with no trips", value: String(idle) }],
        };
      }
      return {
        columns: ["Vehicle", "Trips", "Days used", `Days used (% of ${days})`, "Driving time (h)", "Distance (km)"],
        rows: rows.sort((x, y) => y.a.days.size - x.a.days.size).map(({ v, a }) => [String(v.registration_number), a.trips, a.days.size, `${Math.round((a.days.size / days) * 100)}%`, r1(a.h), r1(a.km)]),
        summary: [{ label: "Fleet days-used average", value: rows.length ? `${Math.round((rows.reduce((s, r) => s + r.a.days.size, 0) / (rows.length * days)) * 100)}%` : "-" }, { label: "Vehicles with no trips", value: String(idle) }],
        note: "Utilisation is based on recorded trips. A vehicle without a working tracker shows no usage even if it was driven.",
      };
    }
    case "drivers": {
      const [{ data: tripData }, { data: drvData }, { data: alertData }] = await Promise.all([
        tripsQuery(),
        supabase.from("drivers").select("id,full_name,status").eq("organization_id", orgId).limit(LIMIT),
        supabase.from("alerts").select("driver_id,type").eq("organization_id", orgId).eq("type", "overspeed").gte("created_at", fromTs).lte("created_at", toTs).limit(LIMIT),
      ]);
      const agg = new Map<string, { trips: number; km: number; h: number; speeding: number }>();
      ((tripData ?? []) as Row[]).forEach((t) => { if (!t.driver_id) return; const a = agg.get(String(t.driver_id)) ?? { trips: 0, km: 0, h: 0, speeding: 0 }; a.trips++; a.km += Number(t.distance_km); a.h += hours(String(t.started_at), t.ended_at ? String(t.ended_at) : null); agg.set(String(t.driver_id), a); });
      ((alertData ?? []) as Row[]).forEach((al) => { if (!al.driver_id) return; const a = agg.get(String(al.driver_id)) ?? { trips: 0, km: 0, h: 0, speeding: 0 }; a.speeding++; agg.set(String(al.driver_id), a); });
      const drivers = ((drvData ?? []) as Row[]).filter((d) => !f.driver || d.id === f.driver);
      return {
        columns: ["Driver", "Status", "Trips", "Distance (km)", "Driving time (h)", "Speeding alerts"],
        rows: drivers.map((d) => { const a = agg.get(String(d.id)) ?? { trips: 0, km: 0, h: 0, speeding: 0 }; return [String(d.full_name), titleCase(String(d.status)), a.trips, r1(a.km), r1(a.h), a.speeding]; }).sort((x, y) => Number(y[3]) - Number(x[3])),
        summary: [{ label: "Active drivers", value: String(drivers.filter((d) => d.status === "active").length) }, { label: "Speeding alerts", value: String([...agg.values()].reduce((s, a) => s + a.speeding, 0)) }],
        note: "Trips are attributed to a driver only when the vehicle had an assigned driver or the trip was created for one.",
      };
    }
    case "fuel": {
      let q = supabase.from("fuel_records").select("vehicle_id,litres,total_cost,currency,odometer_km").eq("organization_id", orgId).gte("fueled_at", f.from).lte("fueled_at", f.to).limit(LIMIT);
      if (f.vehicle) q = q.eq("vehicle_id", f.vehicle);
      const [{ data }, { data: tripData }] = await Promise.all([q, tripsQuery()]);
      const km = new Map<string, number>();
      ((tripData ?? []) as Row[]).forEach((t) => km.set(String(t.vehicle_id), (km.get(String(t.vehicle_id)) ?? 0) + Number(t.distance_km)));
      const agg = new Map<string, { vehicle: string; currency: string; litres: number; cost: number; n: number }>();
      ((data ?? []) as Row[]).forEach((r) => { const key = `${r.vehicle_id}|${r.currency}`; const a = agg.get(key) ?? { vehicle: String(r.vehicle_id), currency: String(r.currency), litres: 0, cost: 0, n: 0 }; a.litres += Number(r.litres); a.cost += Number(r.total_cost); a.n++; agg.set(key, a); });
      const rows = [...agg.values()].sort((a, b) => b.cost - a.cost);
      const totals = new Map<string, number>(); rows.forEach((r) => totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.cost));
      return {
        columns: ["Vehicle", "Currency", "Fill-ups", "Litres", "Total cost", "Cost per litre", "GPS distance (km)", "Cost per km"],
        rows: rows.map((r) => { const d = km.get(r.vehicle) ?? 0; return [vname.get(r.vehicle) ?? "", r.currency, r.n, r1(r.litres), r2(r.cost), r.litres ? r2(r.cost / r.litres) : 0, r1(d), d > 0 ? r2(r.cost / d) : "n/a"]; }),
        summary: [...totals.entries()].map(([c, v]) => ({ label: `Total spend (${c})`, value: v.toLocaleString("en-GB", { maximumFractionDigits: 2 }) })),
        note: "Based on recorded purchases, not verified consumption. Cost per km uses GPS trip distance and is blank where no trips were recorded.",
      };
    }
    case "maintenance": {
      let q = supabase.from("maintenance_records").select("vehicle_id,maintenance_type,service_date,status,cost,currency,provider").eq("organization_id", orgId).gte("service_date", f.from).lte("service_date", f.to).order("service_date", { ascending: false }).limit(LIMIT);
      if (f.vehicle) q = q.eq("vehicle_id", f.vehicle);
      const { data } = await q;
      const rows = (data ?? []) as Row[];
      const totals = new Map<string, number>(); rows.filter((r) => r.status === "completed").forEach((r) => totals.set(String(r.currency), (totals.get(String(r.currency)) ?? 0) + Number(r.cost ?? 0)));
      return {
        columns: ["Date", "Vehicle", "Type", "Provider", "Status", "Currency", "Cost"],
        rows: rows.map((r) => [String(r.service_date), vname.get(String(r.vehicle_id)) ?? "", String(r.maintenance_type), String(r.provider ?? ""), titleCase(String(r.status)), String(r.currency), r.cost == null ? "" : r2(Number(r.cost))]),
        summary: [{ label: "Records", value: String(rows.length) }, ...[...totals.entries()].map(([c, v]) => ({ label: `Completed spend (${c})`, value: v.toLocaleString("en-GB", { maximumFractionDigits: 2 }) }))],
      };
    }
    case "alerts": {
      let q = supabase.from("alerts").select("created_at,type,severity,status,title,vehicle_id,resolution_notes").eq("organization_id", orgId).gte("created_at", fromTs).lte("created_at", toTs).order("created_at", { ascending: false }).limit(LIMIT);
      if (f.vehicle) q = q.eq("vehicle_id", f.vehicle);
      const { data } = await q;
      const rows = (data ?? []) as Row[];
      return {
        columns: ["When", "Vehicle", "Type", "Severity", "Status", "Alert", "Resolution"],
        rows: rows.map((a) => [fmtDT(a.created_at, tz), a.vehicle_id ? vname.get(String(a.vehicle_id)) ?? "" : "", titleCase(String(a.type)), titleCase(String(a.severity)), titleCase(String(a.status)), String(a.title), String(a.resolution_notes ?? "")]),
        summary: [{ label: "Alerts", value: String(rows.length) }, { label: "Critical", value: String(rows.filter((a) => a.severity === "critical").length) }, { label: "Not resolved", value: String(rows.filter((a) => a.status !== "resolved").length) }],
        truncated: rows.length >= LIMIT,
      };
    }
    case "availability": {
      const [{ data: live }, { data: maint }] = await Promise.all([
        supabase.from("vehicle_live_status").select("vehicle_id,registration_number,vehicle_status,connection_state,motion_state,driver_name,last_fix_at").eq("organization_id", orgId).limit(LIMIT),
        supabase.from("maintenance_records").select("vehicle_id").eq("organization_id", orgId).in("status", ["scheduled", "in_progress"]).limit(LIMIT),
      ]);
      const open = new Map<string, number>(); ((maint ?? []) as Row[]).forEach((m) => open.set(String(m.vehicle_id), (open.get(String(m.vehicle_id)) ?? 0) + 1));
      const rows = ((live ?? []) as Row[]).filter((v) => (!f.vehicle || v.vehicle_id === f.vehicle) && v.vehicle_status !== "retired");
      const available = rows.filter((v) => v.vehicle_status === "active").length;
      return {
        columns: ["Vehicle", "Fleet status", "Tracking", "Driver", "Open maintenance", "Last GPS fix"],
        rows: rows.map((v) => [String(v.registration_number), titleCase(String(v.vehicle_status)), v.connection_state === "live" ? titleCase(String(v.motion_state ?? "stopped")) : v.connection_state === "never_reported" ? "No GPS data" : titleCase(String(v.connection_state)), String(v.driver_name ?? "Unassigned"), open.get(String(v.vehicle_id)) ?? 0, fmtDT(v.last_fix_at, tz)]),
        summary: [{ label: "Vehicles", value: String(rows.length) }, { label: "Available (active)", value: String(available) }],
        note: "A point-in-time view as of now; the date range does not apply.",
      };
    }
    case "connectivity": {
      const { data } = await supabase.from("gps_devices").select("imei,manufacturer,model,status,last_communication_at,expected_interval_seconds,vehicle_id,sim_operator").eq("organization_id", orgId).limit(LIMIT);
      const rows = ((data ?? []) as Row[]).filter((d) => !f.vehicle || d.vehicle_id === f.vehicle);
      const states = rows.map((d) => deviceConnection(d.last_communication_at as string | null, Number(d.expected_interval_seconds), String(d.status)));
      return {
        columns: ["IMEI", "Device", "Vehicle", "SIM operator", "Connection", "Last contact"],
        rows: rows.map((d, i) => [String(d.imei), [d.manufacturer, d.model].filter(Boolean).join(" "), d.vehicle_id ? vname.get(String(d.vehicle_id)) ?? "" : "Not linked", String(d.sim_operator ?? ""), states[i].label, fmtDT(d.last_communication_at, tz)]),
        summary: [{ label: "Devices", value: String(rows.length) }, { label: "Reporting", value: String(states.filter((s) => s.label === "Reporting").length) }, { label: "Offline", value: String(states.filter((s) => s.label === "Offline").length) }],
        note: "A point-in-time view as of now; the date range does not apply.",
      };
    }
  }
}

export function toCsv(result: ReportResult): string {
  const esc = (v: string | number) => {
    let s = String(v);
    // neutralise spreadsheet formula injection
    if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [result.columns, ...result.rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
