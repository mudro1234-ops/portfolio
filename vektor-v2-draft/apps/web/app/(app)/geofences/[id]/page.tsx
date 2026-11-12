import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { GeofenceEditor } from "@/components/geofence-editor";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Geofence" };

export default async function GeofenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCapability("geofences");
  const supabase = await createClient();
  const { data: gf } = await supabase.from("geofences").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!gf) notFound();
  const { data: events } = await supabase.from("geofence_events").select("id,event,occurred_at,vehicle:vehicles(id,registration_number)").eq("geofence_id", id).order("occurred_at", { ascending: false }).limit(50);
  const canManage = can(ctx.role, "geofences.manage");

  return (
    <>
      <PageHeader title={gf.name} description={`${gf.shape === "circle" ? `Circle, ${Math.round(gf.radius_m)} m radius` : "Polygon"} - ${gf.is_active ? "active" : "disabled"}`} />
      {canManage ? <GeofenceEditor defaults={{ ...gf, polygon_coords: gf.polygon_coords as [number, number][] | null }} /> : null}
      <Card className="mt-6">
        <CardHeader title="Event history" description="Entries and exits recorded for this geofence" />
        {(events ?? []).length === 0 ? <EmptyState title="No events yet" description="Events appear when a vehicle crosses the boundary after its first position inside this area is recorded." /> : (
          <Table><thead><tr><Th>When</Th><Th>Vehicle</Th><Th>Event</Th></tr></thead><tbody>
            {(events ?? []).map((e) => { const v = (Array.isArray(e.vehicle) ? e.vehicle[0] : e.vehicle) as { id: string; registration_number: string } | null; return (
              <tr key={e.id}><Td>{formatDateTime(e.occurred_at, ctx.org.timezone)}</Td><Td>{v ? <Link className="text-brand hover:underline" href={`/vehicles/${v.id}`}>{v.registration_number}</Link> : "-"}</Td><Td><Badge tone={e.event === "entry" ? "green" : "amber"}>{e.event === "entry" ? "Entered" : "Left"}</Badge></Td></tr>); })}
          </tbody></Table>)}
      </Card>
    </>
  );
}
