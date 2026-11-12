import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MaintenanceForm } from "@/components/maintenance-form";
import { createMaintenance } from "../actions";

export const metadata: Metadata = { title: "Add maintenance" };

export default async function NewMaintenancePage({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const ctx = await requireCapability("maintenance.manage");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: vehicles } = await supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).neq("status", "retired").order("registration_number");
  return (
    <>
      <PageHeader title="Add maintenance" description="Schedule a service or record work already done." />
      <div className="max-w-3xl"><MaintenanceForm action={createMaintenance} defaultCurrency={ctx.org.currency} defaults={{ vehicle_id: sp.vehicle }} vehicles={(vehicles ?? []).map((v) => ({ value: v.id, label: v.registration_number }))} /></div>
    </>
  );
}
