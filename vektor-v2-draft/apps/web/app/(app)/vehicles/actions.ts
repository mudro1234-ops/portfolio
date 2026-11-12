"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, optionalDate, optionalNumber, parseForm } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const vehicleSchema = z.object({
  registration_number: z.string().min(2, "Enter the registration number").max(20, "Too long"),
  category: z.string().default("light_vehicle"),
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  year: optionalNumber.refine((v) => v === undefined || (Number.isInteger(v) && v >= 1950 && v <= new Date().getFullYear() + 1), "Enter a valid year"),
  colour: z.string().max(30).optional(),
  vin: z.string().max(30).optional(),
  fuel_type: z.enum(["diesel", "petrol", "electric", "hybrid", "lpg", "other"]).default("diesel"),
  status: z.enum(["active", "inactive", "maintenance", "retired"]).default("active"),
  odometer_km: optionalNumber.refine((v) => v === undefined || v >= 0, "Cannot be negative"),
  speed_limit_kmh: optionalNumber.refine((v) => v === undefined || v > 0, "Must be greater than 0"),
  insurance_expiry: optionalDate,
  licence_expiry: optionalDate,
  device_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
});

function toRow(d: z.infer<typeof vehicleSchema>) {
  return {
    registration_number: d.registration_number.toUpperCase(),
    category: d.category, make: d.make ?? null, model: d.model ?? null, year: d.year ?? null,
    colour: d.colour ?? null, vin: d.vin ?? null, fuel_type: d.fuel_type, status: d.status,
    odometer_km: d.odometer_km ?? null, speed_limit_kmh: d.speed_limit_kmh ?? null,
    insurance_expiry: d.insurance_expiry ?? null, licence_expiry: d.licence_expiry ?? null,
  };
}

export async function createVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("vehicles.manage");
  if ("error" in a) return a.error;
  const p = parseForm(vehicleSchema, formData);
  if ("error" in p) return p.error;

  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicles")
    .insert({ organization_id: a.ctx.org.id, ...toRow(p.data) }).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, errors: { registration_number: "A vehicle with this registration already exists" }, message: "Duplicate registration number." };
    return { ok: false, message: dbErrorMessage(error) };
  }

  const notes: string[] = [];
  if (p.data.device_id) {
    const { error: e } = await supabase.from("gps_devices").update({ vehicle_id: data.id }).eq("id", p.data.device_id).eq("organization_id", a.ctx.org.id);
    if (e) notes.push("the GPS device could not be linked");
  }
  if (p.data.driver_id) {
    const { error: e } = await supabase.rpc("assign_driver", { p_vehicle: data.id, p_driver: p.data.driver_id });
    if (e) notes.push(`the driver could not be assigned (${dbErrorMessage(e, "unknown error")})`);
  }
  revalidatePath("/vehicles");
  redirect(`/vehicles/${data.id}${notes.length ? `?notice=${encodeURIComponent("Vehicle saved, but " + notes.join(" and ") + ".")}` : ""}`);
}

export async function updateVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("vehicles.manage");
  if ("error" in a) return a.error;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Vehicle not found." };
  const p = parseForm(vehicleSchema, formData);
  if ("error" in p) return p.error;

  const supabase = await createClient();
  const { error, data } = await supabase.from("vehicles").update(toRow(p.data)).eq("id", id.data).select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, errors: { registration_number: "A vehicle with this registration already exists" }, message: "Duplicate registration number." };
    return { ok: false, message: dbErrorMessage(error) };
  }
  if (!data || data.length === 0) return { ok: false, message: "Vehicle not found or you cannot edit it." };
  revalidatePath("/vehicles");
  redirect(`/vehicles/${id.data}`);
}

export async function setVehicleStatus(id: string, status: "active" | "inactive" | "retired"): Promise<ActionState> {
  const a = await actionContext("vehicles.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  if (status === "retired" || status === "inactive") {
    await supabase.rpc("unassign_vehicle", { p_vehicle: id });
  }
  const { error } = await supabase.from("vehicles").update({ status }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/vehicles/${id}`); revalidatePath("/vehicles");
  return { ok: true, message: status === "retired" ? "Vehicle retired and driver unassigned." : status === "inactive" ? "Vehicle deactivated." : "Vehicle reactivated." };
}

export async function assignDriverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("drivers");
  if ("error" in a) return a.error;
  const parsed = z.object({ vehicle_id: z.string().uuid(), driver_id: z.string().uuid("Choose a driver") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: { driver_id: "Choose a driver" }, message: "Choose a driver." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_driver", { p_vehicle: parsed.data.vehicle_id, p_driver: parsed.data.driver_id });
  if (error) return { ok: false, message: dbErrorMessage(error, "Could not assign the driver.") };
  revalidatePath(`/vehicles/${parsed.data.vehicle_id}`); revalidatePath("/drivers");
  return { ok: true, message: "Driver assigned." };
}

export async function unassignVehicleAction(vehicleId: string): Promise<ActionState> {
  const a = await actionContext("drivers");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.rpc("unassign_vehicle", { p_vehicle: vehicleId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/vehicles/${vehicleId}`); revalidatePath("/drivers");
  return { ok: true, message: "Driver unassigned." };
}

export async function linkDeviceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("devices.manage");
  if ("error" in a) return a.error;
  const parsed = z.object({ vehicle_id: z.string().uuid(), device_id: z.string().uuid("Choose a device") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: { device_id: "Choose a device" }, message: "Choose a device." };
  const supabase = await createClient();
  const { error } = await supabase.from("gps_devices").update({ vehicle_id: parsed.data.vehicle_id })
    .eq("id", parsed.data.device_id).eq("organization_id", a.ctx.org.id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/vehicles/${parsed.data.vehicle_id}`); revalidatePath("/devices");
  return { ok: true, message: "GPS device linked." };
}

export async function unlinkDeviceAction(deviceId: string, vehicleId: string): Promise<ActionState> {
  const a = await actionContext("devices.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.from("gps_devices").update({ vehicle_id: null }).eq("id", deviceId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/vehicles/${vehicleId}`); revalidatePath("/devices");
  return { ok: true, message: "GPS device unlinked." };
}
