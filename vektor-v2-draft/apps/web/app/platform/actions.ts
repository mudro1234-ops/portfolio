"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

export async function setOrgStatus(orgId: string, status: "active" | "suspended"): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_org_status", { p_org: orgId, p_status: status });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/platform");
  return { ok: true, message: status === "suspended" ? "Organisation suspended." : "Organisation reactivated." };
}

const subSchema = z.object({
  org: z.string().uuid(),
  plan: z.string().min(2).max(40),
  status: z.enum(["trialing", "active", "past_due", "cancelled"]),
  vehicle_limit: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
  user_limit: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
});

export async function setSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = subSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Check the plan, status and limits." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_subscription", {
    p_org: parsed.data.org, p_plan: parsed.data.plan, p_status: parsed.data.status,
    p_vehicle_limit: parsed.data.vehicle_limit, p_user_limit: parsed.data.user_limit, p_period_end: null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/platform");
  return { ok: true, message: "Subscription updated." };
}
