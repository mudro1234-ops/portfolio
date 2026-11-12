"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

export async function requestPlan(plan: string): Promise<ActionState> {
  const a = await actionContext("billing.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_plan_change", { p_org: a.ctx.org.id, p_plan: plan, p_cancel: false });
  if (error) return { ok: false, message: dbErrorMessage(error, "The request could not be sent.") };
  revalidatePath("/subscription");
  return { ok: true, message: "Plan change requested. VEKTOR will confirm it and arrange payment." };
}

export async function requestCancellation(): Promise<ActionState> {
  const a = await actionContext("billing.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_plan_change", { p_org: a.ctx.org.id, p_plan: null, p_cancel: true });
  if (error) return { ok: false, message: dbErrorMessage(error, "The request could not be sent.") };
  revalidatePath("/subscription");
  return { ok: true, message: "Cancellation requested." };
}
