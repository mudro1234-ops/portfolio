import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "@/components/vehicle-form";
import { updateVehicle } from "../../actions";

export const metadata: Metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCapability("vehicles.manage");
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!vehicle) notFound();
  return (
    <>
      <PageHeader title={`Edit ${vehicle.registration_number}`} />
      <div className="max-w-3xl"><VehicleForm action={updateVehicle} defaults={vehicle} cancelHref={`/vehicles/${id}`} /></div>
    </>
  );
}
