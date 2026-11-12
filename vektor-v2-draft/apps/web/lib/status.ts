/**
 * One status vocabulary for the whole product (guide section 8 & 10).
 * "Device online" is NOT the same as "vehicle moving" - connection comes from the
 * age of the last GPS fix, motion comes from the speed in that fix.
 */
export type ConnectionState = "live" | "stale" | "offline" | "never_reported";
export type MotionState = "moving" | "idle" | "stopped";

export interface LiveStatusRow {
  vehicle_id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  vehicle_status: string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  heading: number | null;
  ignition: boolean | null;
  tracking_source: string | null;
  last_fix_at: string | null;
  last_received_at: string | null;
  motion_state: MotionState | null;
  active_trip_id: string | null;
  device_id: string | null;
  device_last_communication_at: string | null;
  driver_id: string | null;
  driver_name: string | null;
  connection_state: ConnectionState;
  seconds_since_fix: number | null;
}

export type DisplayStatus =
  | "moving" | "idle" | "stopped" | "stale" | "offline" | "never_reported" | "maintenance" | "retired" | "inactive";

export const STATUS_META: Record<DisplayStatus, { label: string; hex: string; tone: Tone }> = {
  moving: { label: "Moving", hex: "#16A36A", tone: "green" },
  idle: { label: "Idle", hex: "#E49A26", tone: "amber" },
  stopped: { label: "Stopped", hex: "#64748B", tone: "grey" },
  stale: { label: "Stale position", hex: "#C98512", tone: "amber" },
  offline: { label: "Offline", hex: "#D94A4A", tone: "red" },
  never_reported: { label: "No GPS data", hex: "#94A3B8", tone: "grey" },
  maintenance: { label: "Maintenance", hex: "#7c5cd6", tone: "purple" },
  retired: { label: "Retired", hex: "#94A3B8", tone: "grey" },
  inactive: { label: "Inactive", hex: "#94A3B8", tone: "grey" },
};

export type Tone = "green" | "amber" | "red" | "grey" | "purple" | "blue" | "slate";

export function displayStatus(row: Pick<LiveStatusRow, "vehicle_status" | "connection_state" | "motion_state">): DisplayStatus {
  if (row.vehicle_status === "retired") return "retired";
  if (row.vehicle_status === "maintenance") return "maintenance";
  if (row.vehicle_status === "inactive") return "inactive";
  if (row.connection_state === "never_reported") return "never_reported";
  if (row.connection_state === "offline") return "offline";
  if (row.connection_state === "stale") return "stale";
  return (row.motion_state ?? "stopped") as DisplayStatus;
}

export const SEVERITY_TONE: Record<string, Tone> = { info: "blue", warning: "amber", critical: "red" };
export const GENERIC_TONE: Record<string, Tone> = {
  active: "green", completed: "green", resolved: "green", acknowledged: "blue", open: "red",
  in_progress: "blue", planned: "slate", scheduled: "blue", cancelled: "grey", inactive: "grey",
  retired: "grey", maintenance: "purple", suspended: "red", trialing: "amber", past_due: "red",
  pending: "amber", accepted: "green", revoked: "grey", expired: "grey", removed: "grey",
};
