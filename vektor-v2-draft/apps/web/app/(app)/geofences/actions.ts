"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, parseForm } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const num = z.preprocess((v) => (v === undefined || v === "" ? undefined : Number(v)), z.number().optional());

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Enter a name").max(80),
  category: z.enum(["depot", "customer", "warehouse", "site", "restricted", "other"]),
  shape: z.enum(["circle", "polygon"]),
  center_lat: num, center_lon: num, radius_m: num,
  polygon: z.string().optional(),
});

export async function saveGeofence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("geofences.manage");
  if ("error" in a) return a.error;
  const p = parseForm(schema, formData);
  if ("error" in p) return p.error;
  const d = p.data;

  const errors: Record<string, string> = {};
  let polygon: [number, number][] | null = null;
  if (d.shape === "circle") {
    if (d.center_lat === undefined || d.center_lat < -90 || d.center_lat > 90) errors.center_lat = "Enter a latitude between -90 and 90";
    if (d.center_lon === undefined || d.center_lon < -180 || d.center_lon > 180) errors.center_lon = "Enter a longitude between -180 and 180";
    if (d.radius_m === undefined || d.radius_m < 20 || d.radius_m > 100000) errors.radius_m = "Radius must be between 20 m and 100 km";
  } else {
    try {
      const parsed = JSON.parse(d.polygon ?? "[]");
      const check = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(3).max(200).safeParse(parsed);
      if (!check.success) errors.polygon = "Click at least 3 points on the map to outline the area";
      else polygon = check.data;
    } catch { errors.polygon = "Click at least 3 points on the map to outline the area"; }
  }
  if (Object.keys(errors).length) return { ok: false, errors, message: "Please fix the highlighted fields." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_geofence", {
    p_org: a.ctx.org.id, p_id: d.id ?? null, p_name: d.name, p_category: d.category, p_shape: d.shape,
    p_center_lat: d.shape === "circle" ? d.center_lat : null, p_center_lon: d.shape === "circle" ? d.center_lon : null,
    p_radius_m: d.shape === "circle" ? d.radius_m : null, p_polygon: polygon,
    p_alert_on_entry: formData.get("alert_on_entry") === "on",
    p_alert_on_exit: formData.get("alert_on_exit") === "on",
    p_is_active: formData.get("is_active") === "on",
  });
  if (error) return { ok: false, message: dbErrorMessage(error, "The geofence could not be saved.") };
  revalidatePath("/geofences");
  redirect("/geofences");
}

export async function deleteGeofence(id: string): Promise<ActionState> {
  const a = await actionContext("geofences.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error, data } = await supabase.from("geofences").delete().eq("id", id).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Geofence not found." };
  revalidatePath("/geofences");
  return { ok: true, message: "Geofence deleted." };
}

export async function toggleGeofence(id: string, active: boolean): Promise<ActionState> {
  const a = await actionContext("geofences.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.from("geofences").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/geofences");
  return { ok: true, message: active ? "Geofence enabled." : "Geofence disabled." };
}
