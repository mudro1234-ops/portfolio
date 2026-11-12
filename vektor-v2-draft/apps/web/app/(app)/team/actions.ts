"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionContext, dbErrorMessage } from "@/lib/action-utils";
import type { ActionState } from "@/components/action-form";

const ROLES = ["admin", "fleet_manager", "dispatcher", "driver", "analyst"] as const;

async function baseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const a = await actionContext("team.manage");
  if ("error" in a) return a.error;
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address"), role: z.enum(ROLES, { errorMap: () => ({ message: "Choose a role" }) }) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])), message: "Please fix the highlighted fields." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_member", { p_org: a.ctx.org.id, p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) return { ok: false, message: dbErrorMessage(error, "The invitation could not be created.") };
  revalidatePath("/team");
  return { ok: true, message: "Invitation created. Copy the link and send it to the person.", data: { link: `${await baseUrl()}/invite/${data}` } };
}

export async function revokeInvitation(id: string): Promise<ActionState> {
  const a = await actionContext("team.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: id });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/team");
  return { ok: true, message: "Invitation revoked." };
}

export async function changeMemberRole(userId: string, role: string): Promise<ActionState> {
  const a = await actionContext("team.manage");
  if ("error" in a) return a.error;
  if (!z.enum(ROLES).safeParse(role).success) return { ok: false, message: "Choose a valid role." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role_status", { p_org: a.ctx.org.id, p_user: userId, p_role: role, p_status: null });
  if (error) return { ok: false, message: dbErrorMessage(error, "The role could not be changed.") };
  revalidatePath("/team");
  return { ok: true, message: "Role updated." };
}

export async function setMemberStatus(userId: string, status: "active" | "suspended" | "removed"): Promise<ActionState> {
  const a = await actionContext("team.manage");
  if ("error" in a) return a.error;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role_status", { p_org: a.ctx.org.id, p_user: userId, p_role: null, p_status: status });
  if (error) return { ok: false, message: dbErrorMessage(error, "Access could not be changed.") };
  revalidatePath("/team");
  return { ok: true, message: status === "active" ? "Access restored." : status === "suspended" ? "Access suspended." : "Member removed." };
}

export async function transferOwnership(userId: string): Promise<ActionState> {
  const a = await actionContext("billing.manage");
  if ("error" in a) return a.error;
  if (a.ctx.role !== "owner") return { ok: false, message: "Only the owner can transfer ownership." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_ownership", { p_org: a.ctx.org.id, p_new_owner: userId });
  if (error) return { ok: false, message: dbErrorMessage(error, "Ownership could not be transferred.") };
  revalidatePath("/team");
  return { ok: true, message: "Ownership transferred. You are now an administrator." };
}
