import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { FuelForm } from "@/components/fuel-form";

export const metadata: Metadata = { title: "Record fuel" };

export default async function NewFuelPage() {
  const ctx = await requireCapability("fuel.add");
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).neq("status", "retired").order("registration_number");
  return (
    <>
      <PageHeader title="Record a fuel purchase" description="Recorded purchases are what was paid for - they are not independently verified fuel consumption." />
      <div className="max-w-3xl"><FuelForm orgId={ctx.org.id} defaultCurrency={ctx.org.currency} vehicles={(vehicles ?? []).map((v) => ({ value: v.id, label: v.registration_number }))} /></div>
    </>
  );
}
