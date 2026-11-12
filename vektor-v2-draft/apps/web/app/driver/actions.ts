"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/action-form";

export async function setConsent(granted: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tracking_consent", { p_granted: granted, p_policy_version: "v1" });
  if (error) return { ok: false, message: "Could not update your consent. Please try again." };
  revalidatePath("/driver");
  return { ok: true, message: granted ? "Thank you. Tracking consent recorded." : "Consent withdrawn. Tracking is switched off." };
}
