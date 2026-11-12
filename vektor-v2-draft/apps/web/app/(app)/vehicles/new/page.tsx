import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "@/components/vehicle-form";
import { createVehicle } from "../actions";

export const metadata: Metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  const ctx = await requireCapability("vehicles.manage");
  const supabase = await createClient();
  const [{ data: devices }, { data: drivers }, { data: assignments }] = await Promise.all([
    supabase.from("gps_devices").select("id,imei,manufacturer,model").eq("organization_id", ctx.org.id).is("vehicle_id", null).eq("status", "active"),
    supabase.from("drivers").select("id,full_name").eq("organization_id", ctx.org.id).eq("status", "active").order("full_name"),
    supabase.from("vehicle_assignments").select("driver_id").eq("organization_id", ctx.org.id).is("unassigned_at", null),
  ]);
  const taken = new Set((assignments ?? []).map((a) => a.driver_id));
  return (
    <>
      <PageHeader title="Add a vehicle" description="Register a vehicle under your organisation. Required fields are marked *." />
      <div className="max-w-3xl">
        <VehicleForm
          action={createVehicle}
          cancelHref="/vehicles"
          devices={(devices ?? []).map((d) => ({ value: d.id, label: `${d.imei}${d.model ? ` - ${[d.manufacturer, d.model].filter(Boolean).join(" ")}` : ""}` }))}
          drivers={(drivers ?? []).filter((d) => !taken.has(d.id)).map((d) => ({ value: d.id, label: d.full_name }))}
        />
      </div>
    </>
  );
}
