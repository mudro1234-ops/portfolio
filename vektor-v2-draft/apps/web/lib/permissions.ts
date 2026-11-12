export type Role = "owner" | "admin" | "fleet_manager" | "dispatcher" | "driver" | "analyst";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  fleet_manager: "Fleet manager",
  dispatcher: "Dispatcher",
  driver: "Driver",
  analyst: "Analyst",
};

export type Capability =
  | "overview" | "live" | "vehicles" | "vehicles.manage" | "drivers" | "drivers.manage"
  | "devices" | "devices.manage" | "trips" | "trips.manage" | "geofences" | "geofences.manage"
  | "alerts" | "alerts.manage" | "maintenance" | "maintenance.manage" | "fuel" | "fuel.add"
  | "fuel.manage" | "reports" | "ai" | "team" | "team.manage" | "billing" | "billing.manage"
  | "settings" | "audit";

const ALL: Capability[] = [
  "overview", "live", "vehicles", "vehicles.manage", "drivers", "drivers.manage", "devices",
  "devices.manage", "trips", "trips.manage", "geofences", "geofences.manage", "alerts",
  "alerts.manage", "maintenance", "maintenance.manage", "fuel", "fuel.add", "fuel.manage",
  "reports", "ai", "team", "team.manage", "billing", "billing.manage", "settings", "audit",
];

const VIEW_ONLY: Capability[] = [
  "overview", "live", "vehicles", "drivers", "devices", "trips", "geofences", "alerts",
  "maintenance", "fuel", "reports", "ai",
];

/**
 * UI capability map, mirroring the permission matrix in the project guide.
 * This only shapes navigation and buttons - the database (RLS + RPC checks) is the
 * real enforcement layer.
 */
const MATRIX: Record<Role, Capability[]> = {
  owner: ALL,
  admin: ALL.filter((c) => c !== "billing.manage"),
  fleet_manager: [
    ...VIEW_ONLY, "vehicles.manage", "drivers.manage", "devices.manage", "trips.manage",
    "geofences.manage", "alerts.manage", "maintenance.manage", "fuel.add", "fuel.manage", "team", "team.manage",
  ],
  dispatcher: [
    "overview", "live", "vehicles", "drivers", "devices", "trips", "trips.manage", "alerts",
    "alerts.manage", "fuel", "fuel.add", "reports", "ai",
  ],
  analyst: VIEW_ONLY,
  driver: [],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && MATRIX[role].includes(capability);
}

export function defaultLandingPath(role: Role): string {
  if (role === "driver") return "/driver";
  if (role === "dispatcher") return "/live";
  if (role === "analyst") return "/reports";
  return "/overview";
}

/** Roles an actor may offer when inviting (the database enforces the same rules). */
export function invitableRoles(role: Role): Role[] {
  if (role === "owner") return ["admin", "fleet_manager", "dispatcher", "driver", "analyst"];
  if (role === "admin") return ["fleet_manager", "dispatcher", "driver", "analyst"];
  if (role === "fleet_manager") return ["driver"];
  return [];
}
