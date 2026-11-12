"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage, parseForm } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const tripSchema = z.object({
  vehicle_id: z.string().uuid("Choose a vehicle"),
  driver_id: z.string().uuid().optional(),
  origin: z.string().max(200).optional(),
  destination: z.string().min(2, "Enter the destination").max(200),
  notes: z.string().max(1000).optional(),
});

export async function createTrip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("trips.manage");
  if ("error" in a) return a.error;
  const p = parseForm(tripSchema, formData);
  if ("error" in p) return p.error;
  const supabase = await createClient();
  let driverId = p.data.driver_id ?? null;
  if (!driverId) {
    const { data } = await supabase.from("vehicle_assignments").select("driver_id").eq("vehicle_id", p.data.vehicle_id).is("unassigned_at", null).maybeSingle();
    driverId = data?.driver_id ?? null;
  }
  const { data, error } = await supabase.from("trips").insert({
    organization_id: a.ctx.org.id, vehicle_id: p.data.vehicle_id, driver_id: driverId, status: "planned",
    origin: p.data.origin ?? null, destination: p.data.destination, notes: p.data.notes ?? null, source: "manual", created_by: a.ctx.userId,
  }).select("id").single();
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/trips");
  redirect(`/trips/${data.id}`);
}

export async function startTrip(id: string): Promise<ActionState> {
  const a = await actionContext("trips.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error, data } = await supabase.from("trips").update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", id).eq("status", "planned").select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, message: "This vehicle already has a trip in progress. Complete that trip first." };
    return { ok: false, message: dbErrorMessage(error) };
  }
  if (!data?.length) return { ok: false, message: "Only planned trips can be started." };
  revalidatePath(`/trips/${id}`); revalidatePath("/trips");
  return { ok: true, message: "Trip started." };
}

export async function completeTrip(id: string): Promise<ActionState> {
  const a = await actionContext("trips.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error, data } = await supabase.from("trips").update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", id).eq("status", "in_progress").select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Only trips in progress can be completed." };
  revalidatePath(`/trips/${id}`); revalidatePath("/trips");
  return { ok: true, message: "Trip completed." };
}

export async function cancelTrip(id: string): Promise<ActionState> {
  const a = await actionContext("trips.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error, data } = await supabase.from("trips").update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("id", id).in("status", ["planned", "in_progress"]).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "This trip can no longer be cancelled." };
  revalidatePath(`/trips/${id}`); revalidatePath("/trips");
  return { ok: true, message: "Trip cancelled." };
}

export async function saveTripNotes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("trips.manage");
  if ("error" in a) return a.error;
  const parsed = z.object({ id: z.string().uuid(), notes: z.string().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Notes are too long." };
  const supabase = await createClient();
  const { error } = await supabase.from("trips").update({ notes: parsed.data.notes?.trim() || null }).eq("id", parsed.data.id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/trips/${parsed.data.id}`);
  return { ok: true, message: "Notes saved." };
}
