import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MaintenanceForm } from "@/components/maintenance-form";
import { updateMaintenance } from "../actions";

export const metadata: Metadata = { title: "Edit maintenance" };

export default async function EditMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCapability("maintenance.manage");
  const supabase = await createClient();
  const [{ data: rec }, { data: vehicles }] = await Promise.all([
    supabase.from("maintenance_records").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle(),
    supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).order("registration_number"),
  ]);
  if (!rec) notFound();
  return (
    <>
      <PageHeader title="Edit maintenance record" />
      <div className="max-w-3xl"><MaintenanceForm action={updateMaintenance} defaultCurrency={ctx.org.currency} defaults={rec} vehicles={(vehicles ?? []).map((v) => ({ value: v.id, label: v.registration_number }))} /></div>
    </>
  );
}
