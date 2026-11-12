"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, optionalNumber, parseForm } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const schema = z.object({
  vehicle_id: z.string().uuid("Choose a vehicle"),
  fueled_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date"),
  litres: z.preprocess((v) => Number(v), z.number({ invalid_type_error: "Enter the litres" }).positive("Must be greater than 0").max(5000, "That looks too high")),
  total_cost: z.preprocess((v) => Number(v), z.number({ invalid_type_error: "Enter the total cost" }).min(0, "Cannot be negative")),
  currency: z.string().length(3).default("USD"),
  odometer_km: optionalNumber.refine((v) => v === undefined || v >= 0, "Cannot be negative"),
  station: z.string().max(100).optional(),
  receipt_path: z.string().max(300).optional(),
});

export async function createFuelRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("fuel.add");
  if ("error" in a) return a.error;
  const p = parseForm(schema, formData);
  if ("error" in p) return p.error;
  const d = p.data;
  if (d.receipt_path && !d.receipt_path.startsWith(`${a.ctx.org.id}/`)) return { ok: false, message: "Invalid receipt upload." };
  const supabase = await createClient();
  const { error } = await supabase.from("fuel_records").insert({
    organization_id: a.ctx.org.id, vehicle_id: d.vehicle_id, fueled_at: d.fueled_at, litres: d.litres, total_cost: d.total_cost,
    currency: d.currency.toUpperCase(), odometer_km: d.odometer_km ?? null, station: d.station ?? null, receipt_path: d.receipt_path ?? null, created_by: a.ctx.userId,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  // keep the vehicle odometer in step when the reading is higher than what we hold
  if (d.odometer_km != null) {
    const { data: v } = await supabase.from("vehicles").select("odometer_km").eq("id", d.vehicle_id).maybeSingle();
    if (v && (v.odometer_km == null || Number(v.odometer_km) < d.odometer_km)) await supabase.from("vehicles").update({ odometer_km: d.odometer_km }).eq("id", d.vehicle_id);
  }
  revalidatePath("/fuel");
  redirect("/fuel");
}

export async function deleteFuelRecord(id: string): Promise<ActionState> {
  const a = await actionContext("fuel.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { data: rec } = await supabase.from("fuel_records").select("receipt_path").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("fuel_records").delete().eq("id", id).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Record not found." };
  if (rec?.receipt_path) await supabase.storage.from("receipts").remove([rec.receipt_path]);
  revalidatePath("/fuel");
  return { ok: true, message: "Fuel record deleted." };
}
