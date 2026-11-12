"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/context";
import type { ActionState } from "@/components/action-form";

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function appUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** Only allow same-site relative redirects. */
function safeNext(value: unknown, fallback = "/overview"): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: "Incorrect email or password.", errors: { password: "Incorrect email or password" } };
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    full_name: z.string().trim().min(2, "Enter your full name"),
    email: emailSchema,
    password: z.string().min(8, "Use at least 8 characters"),
    confirm: z.string(),
  }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const next = safeNext(formData.get("next"), "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, message: error.message };
  if (data.session) redirect(next);
  return { ok: true, message: "Account created. Check your email and follow the link to verify your account." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ email: emailSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await appUrl()}/auth/callback?next=/reset-password`,
  });
  // Same message whether or not the account exists (no account enumeration).
  return { ok: true, message: "If that email has an account, a reset link is on its way." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password updated." };
}

export async function createOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    name: z.string().trim().min(2, "Enter the company name"),
    contact_email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
    contact_phone: z.string().trim().optional(),
    country: z.string().trim().length(2, "Use a 2-letter country code").default("ZW"),
    currency: z.string().trim().length(3, "Use a 3-letter currency code").default("USD"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_contact_email: parsed.data.contact_email || null,
    p_contact_phone: parsed.data.contact_phone || null,
    p_country: parsed.data.country,
    p_currency: parsed.data.currency,
  });
  if (error) return { ok: false, message: "Could not create the organisation. Please try again." };
  (await cookies()).set(ORG_COOKIE, data as string, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/overview?welcome=1");
}

export async function acceptInvitation(token: string): Promise<ActionState> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, message: "This invitation link is not valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) {
    const map: Record<string, string> = {
      invitation_invalid: "This invitation is no longer valid.",
      invitation_expired: "This invitation has expired. Ask for a new one.",
      invitation_email_mismatch: "This invitation was sent to a different email address. Sign in with the invited email.",
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    return { ok: false, message: key ? map[key] : "Could not accept the invitation." };
  }
  (await cookies()).set(ORG_COOKIE, data as string, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/overview");
}

export async function acceptInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return acceptInvitation(String(formData.get("token") ?? ""));
}

export async function switchOrganization(orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("organization_memberships").select("organization_id")
    .eq("user_id", user.id).eq("organization_id", orgId).eq("status", "active").maybeSingle();
  if (data) (await cookies()).set(ORG_COOKIE, orgId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  redirect("/overview");
}
