import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { NewTripForm } from "@/components/trip-controls";

export const metadata: Metadata = { title: "Create trip" };

export default async function NewTripPage() {
  const ctx = await requireCapability("trips.manage");
  const supabase = await createClient();
  const [{ data: vehicles }, { data: drivers }] = await Promise.all([
    supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).eq("status", "active").order("registration_number"),
    supabase.from("drivers").select("id,full_name").eq("organization_id", ctx.org.id).eq("status", "active").order("full_name"),
  ]);
  return (
    <>
      <PageHeader title="Create a trip" description="Plan a journey for a vehicle. Most trips are recorded automatically from GPS movement; use this for planned or assigned work." />
      <div className="max-w-3xl"><NewTripForm vehicles={(vehicles ?? []).map((v) => ({ value: v.id, label: v.registration_number }))} drivers={(drivers ?? []).map((d) => ({ value: d.id, label: d.full_name }))} /></div>
    </>
  );
}
