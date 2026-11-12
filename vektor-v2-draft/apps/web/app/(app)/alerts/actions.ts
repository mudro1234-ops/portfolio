"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

export async function acknowledgeAlert(id: string): Promise<ActionState> {
  const a = await actionContext("alerts.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { data, error } = await supabase.from("alerts")
    .update({ status: "acknowledged", acknowledged_by: a.ctx.userId, acknowledged_at: new Date().toISOString() })
    .eq("id", id).eq("status", "open").select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "This alert is no longer open." };
  revalidatePath("/alerts"); revalidatePath("/overview");
  return { ok: true, message: "Alert acknowledged." };
}

export async function resolveAlert(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("alerts.manage");
  if ("error" in a) return a.error;
  const parsed = z.object({ id: z.string().uuid(), notes: z.string().max(1000).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Resolution notes are too long." };
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("alerts")
    .update({ status: "resolved", resolved_at: now, resolution_notes: parsed.data.notes?.trim() || null, acknowledged_by: a.ctx.userId, acknowledged_at: now })
    .eq("id", parsed.data.id).neq("status", "resolved").select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "This alert is already resolved." };
  revalidatePath("/alerts"); revalidatePath("/overview");
  return { ok: true, message: "Alert resolved." };
}
