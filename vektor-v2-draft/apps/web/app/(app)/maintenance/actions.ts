"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, optionalDate, optionalNumber, parseForm } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const schema = z.object({
  vehicle_id: z.string().uuid("Choose a vehicle"),
  maintenance_type: z.string().min(2, "Choose or enter a type").max(80),
  description: z.string().max(1000).optional(),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the service date"),
  next_service_date: optionalDate,
  next_service_odometer_km: optionalNumber.refine((v) => v === undefined || v >= 0, "Cannot be negative"),
  cost: optionalNumber.refine((v) => v === undefined || v >= 0, "Cannot be negative"),
  currency: z.string().length(3).default("USD"),
  provider: z.string().max(100).optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
});

const toRow = (d: z.infer<typeof schema>) => ({
  vehicle_id: d.vehicle_id, maintenance_type: d.maintenance_type, description: d.description ?? null,
  service_date: d.service_date, next_service_date: d.next_service_date ?? null,
  next_service_odometer_km: d.next_service_odometer_km ?? null, cost: d.cost ?? null,
  currency: d.currency.toUpperCase(), provider: d.provider ?? null, status: d.status,
});

export async function createMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("maintenance.manage");
  if ("error" in a) return a.error;
  const p = parseForm(schema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_records").insert({ organization_id: a.ctx.org.id, created_by: a.ctx.userId, ...toRow(p.data) });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/maintenance");
  redirect("/maintenance");
}

export async function updateMaintenance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("maintenance.manage");
  if ("error" in a) return a.error;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Record not found." };
  const p = parseForm(schema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("maintenance_records").update(toRow(p.data)).eq("id", id.data).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Record not found or you cannot edit it." };
  revalidatePath("/maintenance");
  redirect("/maintenance");
}

export async function completeMaintenance(id: string): Promise<ActionState> {
  const a = await actionContext("maintenance.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("maintenance_records").update({ status: "completed" }).eq("id", id).in("status", ["scheduled", "in_progress"]).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "This record is already closed." };
  revalidatePath("/maintenance");
  return { ok: true, message: "Marked as completed." };
}

export async function deleteMaintenance(id: string): Promise<ActionState> {
  const a = await actionContext("maintenance.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("maintenance_records").delete().eq("id", id).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Record not found." };
  revalidatePath("/maintenance");
  return { ok: true, message: "Record deleted." };
}
