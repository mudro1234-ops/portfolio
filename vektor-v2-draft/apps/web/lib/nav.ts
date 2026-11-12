import { can, type Capability, type Role } from "@/lib/permissions";

export type IconName =
  | "layout" | "map" | "truck" | "users" | "route" | "hexagon" | "bell" | "wrench" | "fuel"
  | "chart" | "bot" | "shield" | "card" | "settings" | "cpu" | "history" | "globe" | "help";

export interface NavItem { href: string; label: string; icon: IconName; capability: Capability }

export const WORKSPACE_NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "layout", capability: "overview" },
  { href: "/live", label: "Live Tracking", icon: "map", capability: "live" },
  { href: "/vehicles", label: "Vehicles", icon: "truck", capability: "vehicles" },
  { href: "/drivers", label: "Drivers", icon: "users", capability: "drivers" },
  { href: "/devices", label: "GPS Devices", icon: "cpu", capability: "devices" },
  { href: "/trips", label: "Trips", icon: "route", capability: "trips" },
  { href: "/geofences", label: "Geofences", icon: "hexagon", capability: "geofences" },
  { href: "/alerts", label: "Alerts", icon: "bell", capability: "alerts" },
  { href: "/maintenance", label: "Maintenance", icon: "wrench", capability: "maintenance" },
  { href: "/fuel", label: "Fuel & Expenses", icon: "fuel", capability: "fuel" },
  { href: "/reports", label: "Reports", icon: "chart", capability: "reports" },
  { href: "/ai", label: "AI Fleet Assistant", icon: "bot", capability: "ai" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/team", label: "Team & Permissions", icon: "shield", capability: "team" },
  { href: "/subscription", label: "Subscription", icon: "card", capability: "billing" },
  { href: "/audit", label: "Audit Log", icon: "history", capability: "audit" },
  { href: "/settings", label: "Settings", icon: "settings", capability: "settings" },
];

export function visibleNav(role: Role, isPlatformAdmin: boolean) {
  const workspace = WORKSPACE_NAV.filter((i) => can(role, i.capability));
  const admin = ADMIN_NAV.filter((i) => can(role, i.capability));
  if (isPlatformAdmin) admin.push({ href: "/platform", label: "Platform admin", icon: "globe", capability: "overview" });
  return { workspace, admin };
}
