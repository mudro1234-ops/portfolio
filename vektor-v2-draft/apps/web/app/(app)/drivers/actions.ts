"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, optionalDate, parseForm } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const driverSchema = z.object({
  full_name: z.string().min(2, "Enter the driver's full name").max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email("Enter a valid email").optional(),
  licence_number: z.string().max(40).optional(),
  licence_expiry: optionalDate,
  emergency_contact: z.string().max(200).optional(),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
});

const toRow = (d: z.infer<typeof driverSchema>) => ({
  full_name: d.full_name, phone: d.phone ?? null, email: d.email?.toLowerCase() ?? null,
  licence_number: d.licence_number ?? null, licence_expiry: d.licence_expiry ?? null,
  emergency_contact: d.emergency_contact ?? null, status: d.status,
});

export async function createDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("drivers.manage");
  if ("error" in a) return a.error;
  const p = parseForm(driverSchema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("drivers").insert({ organization_id: a.ctx.org.id, ...toRow(p.data) }).select("id").single();
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/drivers");
  redirect(`/drivers/${data.id}`);
}

export async function updateDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("drivers.manage");
  if ("error" in a) return a.error;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Driver not found." };
  const p = parseForm(driverSchema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("drivers").update(toRow(p.data)).eq("id", id.data).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Driver not found or you cannot edit it." };
  if (p.data.status !== "active") {
    const { data: open } = await supabase.from("vehicle_assignments").select("vehicle_id").eq("driver_id", id.data).is("unassigned_at", null);
    for (const row of open ?? []) await supabase.rpc("unassign_vehicle", { p_vehicle: row.vehicle_id });
  }
  revalidatePath("/drivers"); revalidatePath(`/drivers/${id.data}`);
  return { ok: true, message: "Driver saved." };
}

export async function deactivateDriver(id: string): Promise<ActionState> {
  const a = await actionContext("drivers.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  // close any open assignment first so the vehicle is not left tied to an inactive driver
  const { data: open } = await supabase.from("vehicle_assignments").select("vehicle_id").eq("driver_id", id).is("unassigned_at", null);
  for (const row of open ?? []) await supabase.rpc("unassign_vehicle", { p_vehicle: row.vehicle_id });
  const { error } = await supabase.from("drivers").update({ status: "inactive" }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/drivers"); revalidatePath(`/drivers/${id}`);
  return { ok: true, message: "Driver deactivated and unassigned." };
}

export async function reactivateDriver(id: string): Promise<ActionState> {
  const a = await actionContext("drivers.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").update({ status: "active" }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/drivers"); revalidatePath(`/drivers/${id}`);
  return { ok: true, message: "Driver reactivated." };
}
