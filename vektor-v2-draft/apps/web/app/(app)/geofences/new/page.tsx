import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { PageHeader } from "@/components/ui";
import { GeofenceEditor } from "@/components/geofence-editor";

export const metadata: Metadata = { title: "New geofence" };

export default async function NewGeofencePage() {
  await requireCapability("geofences.manage");
  return (<><PageHeader title="New geofence" description="Mark an area on the map. Vehicles entering or leaving it are recorded and can raise alerts." /><GeofenceEditor /></>);
}
