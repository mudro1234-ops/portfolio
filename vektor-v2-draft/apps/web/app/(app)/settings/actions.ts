"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, parseForm } from "@/lib/action-utils";
import { getAppContext } from "@/lib/context";
import type { ActionState } from "@/components/action-form";

const orgSchema = z.object({
  name: z.string().min(2, "Enter the company name").max(100),
  contact_email: z.string().email("Enter a valid email").optional(),
  contact_phone: z.string().max(30).optional(),
  country: z.string().length(2, "Use a 2-letter country code"),
  currency: z.string().length(3, "Use a 3-letter currency code"),
  timezone: z.string().refine((v) => { try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; } }, "Unknown time zone"),
});

export async function updateOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("settings");
  if ("error" in a) return a.error;
  const p = parseForm(orgSchema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update({
    name: p.data.name, contact_email: p.data.contact_email ?? null, contact_phone: p.data.contact_phone ?? null,
    country: p.data.country.toUpperCase(), currency: p.data.currency.toUpperCase(), timezone: p.data.timezone,
  }).eq("id", a.ctx.org.id).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Only owners and administrators can change organisation settings." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Organisation settings saved." };
}

const num = (min: number, max: number, msg: string) => z.preprocess((v) => Number(v), z.number({ invalid_type_error: msg }).min(min, msg).max(max, msg));
const thresholdSchema = z.object({
  trip_start_speed_kmh: num(1, 100, "Enter 1 to 100"),
  trip_end_speed_kmh: num(0, 50, "Enter 0 to 50"),
  trip_end_minutes: num(1, 120, "Enter 1 to 120 minutes"),
  stale_after_seconds: num(30, 86400, "Enter 30 to 86400 seconds"),
  offline_after_seconds: num(60, 604800, "Enter 60 to 604800 seconds"),
  position_retention_days: num(7, 3650, "Enter 7 to 3650 days"),
}).superRefine((v, ctx) => {
  if (v.trip_end_speed_kmh >= v.trip_start_speed_kmh) ctx.addIssue({ code: "custom", path: ["trip_end_speed_kmh"], message: "Must be lower than the trip start speed" });
  if (v.stale_after_seconds >= v.offline_after_seconds) ctx.addIssue({ code: "custom", path: ["offline_after_seconds"], message: "Must be longer than the stale threshold" });
});

export async function updateThresholds(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("settings");
  if ("error" in a) return a.error;
  const p = parseForm(thresholdSchema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").update(p.data).eq("id", a.ctx.org.id).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Only owners and administrators can change these settings." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Tracking thresholds saved. They apply to new GPS positions." };
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await getAppContext();
  const p = parseForm(z.object({ full_name: z.string().min(2, "Enter your name").max(100), phone: z.string().max(30).optional() }), formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  const { error } = await supabase.from("user_profiles").update({ full_name: p.data.full_name, phone: p.data.phone ?? null }).eq("id", ctx.userId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}
