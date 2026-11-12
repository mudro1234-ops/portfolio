import Link from "next/link";
import type { Metadata } from "next";
import { Hexagon, Plus } from "lucide-react";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { MapCanvas } from "@/components/map-canvas";
import { GeofenceRowActions } from "@/components/geofence-controls";
import { titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Geofences" };

export default async function GeofencesPage() {
  const ctx = await requireCapability("geofences");
  const supabase = await createClient();
  const { data } = await supabase.from("geofences").select("*").eq("organization_id", ctx.org.id).order("name");
  const rows = data ?? [];
  const canManage = can(ctx.role, "geofences.manage");
  const circles = rows.filter((g) => g.shape === "circle" && g.center_latitude != null).map((g) => ({ id: g.id, lng: g.center_longitude as number, lat: g.center_latitude as number, radius: g.radius_m as number, color: g.category === "restricted" ? "#D94A4A" : "#246BFD" }));
  const polygons = rows.filter((g) => g.shape === "polygon" && Array.isArray(g.polygon_coords)).map((g) => ({ id: g.id, coords: g.polygon_coords as [number, number][], color: g.category === "restricted" ? "#D94A4A" : "#246BFD" }));

  return (
    <>
      <PageHeader title="Geofences" description="Monitored areas such as depots, customer sites and restricted zones."
        actions={canManage ? <LinkButton href="/geofences/new"><Plus className="h-4 w-4" /> New geofence</LinkButton> : undefined} />
      {rows.length === 0 ? (
        <Card><EmptyState icon={<Hexagon className="h-6 w-6" />} title="No geofences yet" description="Create a geofence to be alerted when vehicles enter or leave an area."
          action={canManage ? <LinkButton href="/geofences/new">Create geofence</LinkButton> : undefined} /></Card>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden"><MapCanvas height={360} circles={circles} polygons={polygons} fitKey={rows.length} /></Card>
          <Card><Table><thead><tr><Th>Name</Th><Th>Category</Th><Th>Shape</Th><Th>Alerts</Th><Th>Status</Th>{canManage && <Th />}</tr></thead><tbody>
            {rows.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50">
                <Td><Link href={`/geofences/${g.id}`} className="font-medium text-brand hover:underline">{g.name}</Link></Td>
                <Td>{titleCase(g.category)}</Td>
                <Td>{g.shape === "circle" ? `Circle, ${Math.round(g.radius_m)} m` : "Polygon"}</Td>
                <Td>{[g.alert_on_entry && "Entry", g.alert_on_exit && "Exit"].filter(Boolean).join(" + ") || "None"}</Td>
                <Td><Badge tone={g.is_active ? "green" : "grey"}>{g.is_active ? "Active" : "Disabled"}</Badge></Td>
                {canManage && <Td><GeofenceRowActions id={g.id} active={g.is_active} /></Td>}
              </tr>
            ))}
          </tbody></Table></Card>
        </div>
      )}
    </>
  );
}
