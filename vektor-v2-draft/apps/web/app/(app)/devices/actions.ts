"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, optionalDate, optionalNumber, parseForm } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const deviceSchema = z.object({
  imei: z.string().regex(/^[A-Za-z0-9\-_]{5,40}$/, "Enter the device IMEI or unique identifier (5-40 letters/digits)"),
  manufacturer: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  protocol: z.string().max(40).optional(),
  provider_device_id: z.string().max(60).optional(),
  sim_operator: z.string().max(40).optional(),
  sim_msisdn: z.string().max(25).optional(),
  sim_iccid: z.string().max(30).optional(),
  firmware_version: z.string().max(40).optional(),
  installed_at: optionalDate,
  installation_notes: z.string().max(1000).optional(),
  expected_interval_seconds: optionalNumber.refine((v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 86400), "Enter seconds between 1 and 86400"),
  vehicle_id: z.string().uuid().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const toRow = (d: z.infer<typeof deviceSchema>) => ({
  imei: d.imei.trim(), manufacturer: d.manufacturer ?? null, model: d.model ?? null, protocol: d.protocol ?? null,
  provider_device_id: d.provider_device_id ?? null, sim_operator: d.sim_operator ?? null, sim_msisdn: d.sim_msisdn ?? null,
  sim_iccid: d.sim_iccid ?? null, firmware_version: d.firmware_version ?? null, installed_at: d.installed_at ?? null,
  installation_notes: d.installation_notes ?? null, expected_interval_seconds: d.expected_interval_seconds ?? 60,
  vehicle_id: d.vehicle_id ?? null, status: d.status,
});

export async function createDevice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("devices.manage");
  if ("error" in a) return a.error;
  const p = parseForm(deviceSchema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("gps_devices").insert({ organization_id: a.ctx.org.id, ...toRow(p.data) }).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, errors: { imei: "This IMEI is already registered" }, message: "This IMEI is already registered." };
    return { ok: false, message: dbErrorMessage(error) };
  }
  revalidatePath("/devices");
  redirect(`/devices/${data.id}`);
}

export async function updateDevice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("devices.manage");
  if ("error" in a) return a.error;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Device not found." };
  const p = parseForm(deviceSchema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("gps_devices").update(toRow(p.data)).eq("id", id.data).select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, errors: { imei: "This IMEI is already registered" }, message: "This IMEI is already registered." };
    return { ok: false, message: dbErrorMessage(error) };
  }
  if (!data?.length) return { ok: false, message: "Device not found or you cannot edit it." };
  revalidatePath("/devices"); revalidatePath(`/devices/${id.data}`);
  return { ok: true, message: "Device saved." };
}

export async function deleteDevice(id: string): Promise<ActionState> {
  const a = await actionContext("devices.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error, data } = await supabase.from("gps_devices").delete().eq("id", id).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Only owners and administrators can delete devices. Set it to inactive instead." };
  revalidatePath("/devices");
  return { ok: true, message: "Device deleted." };
}
