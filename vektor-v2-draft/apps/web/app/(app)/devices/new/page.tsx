import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { DeviceForm } from "@/components/device-form";
import { createDevice } from "../actions";

export const metadata: Metadata = { title: "Register GPS device" };

export default async function NewDevicePage() {
  const ctx = await requireCapability("devices.manage");
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).neq("status", "retired").order("registration_number");
  return (
    <>
      <PageHeader title="Register a GPS device" description="Add the tracker's details, then link it to the vehicle it is installed in." />
      <div className="max-w-3xl"><DeviceForm action={createDevice} cancelHref="/devices" vehicles={(vehicles ?? []).map((v) => ({ value: v.id, label: v.registration_number }))} /></div>
    </>
  );
}
