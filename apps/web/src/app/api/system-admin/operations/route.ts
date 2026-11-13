import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const roles = ["owner", "admin", "fleet_manager", "dispatcher", "driver", "analyst"] as const;
const subscriptionStatuses = ["trialing", "active", "past_due", "canceled", "incomplete"] as const;
const workspaceStatuses = ["active", "suspended", "archived"] as const;
const supportStatuses = ["open", "in_progress", "waiting", "resolved", "closed"] as const;

async function getContext() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in is required." }, { status: 401 }) } as const;
  const { data: adminRow, error: adminError } = await session.from("system_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !adminRow) return { response: NextResponse.json({ error: "System administrator access is required." }, { status: 403 }) } as const;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return { response: NextResponse.json({ error: "Server-side Supabase admin credentials are not configured." }, { status: 503 }) } as const;
  return { user, admin: createAdminClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) } as const;
}

async function audit(admin: ReturnType<typeof createAdminClient>, actor: string, action: string, type: string, id: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await admin.from("audit_logs").insert({ actor_user_id: actor, action, resource_type: type, resource_id: id, metadata });
  if (error) throw error;
}

export async function GET() {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { admin } = context;
  try {
    const [orgs, memberships, vehicles, devices, apps, subscriptions, logs, support, settings, userPage] = await Promise.all([
      admin.from("organizations").select("id,name,slug,workspace_type,contact_email,contact_phone,country_code,currency_code,account_status,status_reason,status_changed_at,created_at").order("created_at", { ascending: false }).limit(500),
      admin.from("organization_memberships").select("id,organization_id,user_id,role,created_at").order("created_at", { ascending: false }).limit(1000),
      admin.from("vehicles").select("id,organization_id,registration_number,make,model,status,created_at").order("created_at", { ascending: false }).limit(1000),
      admin.from("gps_devices").select("id,organization_id,vehicle_id,label,unique_id,provider,provider_device_id,active,last_seen_at,manufacturer,model,created_at").order("created_at", { ascending: false }).limit(1000),
      admin.from("workspace_applications").select("id,applicant_user_id,workspace_type,workspace_name,contact_email,contact_phone,country_code,currency_code,status,review_note,reviewed_at,created_at,organization_id").order("created_at", { ascending: false }).limit(500),
      admin.from("subscription_accounts").select("id,organization_id,plan_code,status,trial_ends_at,current_period_end,created_at").limit(500),
      admin.from("audit_logs").select("id,organization_id,actor_user_id,action,resource_type,resource_id,metadata,created_at").order("created_at", { ascending: false }).limit(250),
      admin.from("support_requests").select("id,organization_id,requester_user_id,subject,description,status,priority,assigned_to,internal_notes,created_at,updated_at").order("created_at", { ascending: false }).limit(250),
      admin.from("platform_settings").select("key,value,description,updated_at").order("key"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const failures = [orgs, memberships, vehicles, devices, apps, subscriptions, logs, support, settings].filter(x => x.error);
    if (failures.length) throw failures[0].error;
    const users = userPage.data?.users ?? [];
    const userMap = Object.fromEntries(users.map(u => [u.id, { id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email_confirmed_at: u.email_confirmed_at, banned_until: u.banned_until, user_metadata: u.user_metadata }]));
    const orgMap = Object.fromEntries((orgs.data ?? []).map(o => [o.id, o]));
    const memberRows = (memberships.data ?? []).map(m => ({ ...m, user: userMap[m.user_id] ?? null, organization: orgMap[m.organization_id] ?? null }));
    const vehicleRows = (vehicles.data ?? []).map(v => ({ ...v, organization: orgMap[v.organization_id] ?? null }));
    const deviceRows = (devices.data ?? []).map(d => ({ ...d, organization: orgMap[d.organization_id] ?? null, online: Boolean(d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 120000) }));
    const subscriptionRows = (subscriptions.data ?? []).map(s => ({ ...s, organization: orgMap[s.organization_id] ?? null }));
    const logRows = (logs.data ?? []).map(l => ({ ...l, actor: userMap[l.actor_user_id] ?? null, organization: orgMap[l.organization_id] ?? null }));
    const supportRows = (support.data ?? []).map(s => ({ ...s, requester: userMap[s.requester_user_id] ?? null }));
    const env = (name: string) => Boolean(process.env[name]);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      stats: {
        companies: (orgs.data ?? []).filter(o => o.workspace_type === "company").length,
        individuals: (orgs.data ?? []).filter(o => o.workspace_type === "individual").length,
        activeWorkspaces: (orgs.data ?? []).filter(o => o.account_status === "active").length,
        suspendedWorkspaces: (orgs.data ?? []).filter(o => o.account_status === "suspended").length,
        archivedWorkspaces: (orgs.data ?? []).filter(o => o.account_status === "archived").length,
        users: users.length, vehicles: (vehicles.data ?? []).length, devices: (devices.data ?? []).length,
        onlineDevices: deviceRows.filter(d => d.online).length,
        pendingApplications: (apps.data ?? []).filter(a => a.status === "pending").length,
        openSupport: supportRows.filter(s => ["open", "in_progress", "waiting"].includes(s.status)).length,
      },
      workspaces: orgs.data ?? [], users: users.map(u => userMap[u.id]), memberships: memberRows,
      vehicles: vehicleRows, devices: deviceRows, applications: apps.data ?? [],
      subscriptions: subscriptionRows, auditLogs: logRows, supportRequests: supportRows,
      settings: settings.data ?? [],
      integrations: {
        database: { configured: env("NEXT_PUBLIC_SUPABASE_URL") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), status: "connected" },
        mapbox: { configured: env("NEXT_PUBLIC_MAPBOX_TOKEN") },
        traccar: { configured: env("TRACCAR_WEBHOOK_SECRET") && env("SUPABASE_SERVICE_ROLE_KEY") },
        gemini: { configured: env("GEMINI_API_KEY") },
        groq: { configured: env("GROQ_API_KEY") },
        openrouter: { configured: env("OPENROUTER_API_KEY") },
        email: { configured: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST) },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load platform administration data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { user, admin } = context;
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    if (action === "workspace_update") {
      const id = String(body.id ?? "");
      const name = String(body.name ?? "").trim();
      const contact_email = String(body.contact_email ?? "").trim().toLowerCase();
      const contact_phone = String(body.contact_phone ?? "").trim();
      if (!id || name.length < 2 || name.length > 120) return NextResponse.json({ error: "Enter a workspace name between 2 and 120 characters." }, { status: 400 });
      const { error } = await admin.from("organizations").update({ name, contact_email: contact_email || null, contact_phone: contact_phone || null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await audit(admin, user.id, "workspace_updated", "organization", id, { name, contact_email, contact_phone });
    } else if (action === "workspace_status") {
      const id = String(body.id ?? ""), status = String(body.status ?? ""), reason = String(body.reason ?? "").trim();
      if (!id || !workspaceStatuses.includes(status as typeof workspaceStatuses[number])) return NextResponse.json({ error: "Invalid workspace status." }, { status: 400 });
      if (status !== "active" && reason.length < 5) return NextResponse.json({ error: "Provide an administrative reason of at least 5 characters." }, { status: 400 });
      const { error } = await admin.from("organizations").update({ account_status: status, status_reason: reason || null, status_changed_at: new Date().toISOString(), status_changed_by: user.id, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await audit(admin, user.id, "workspace_status_changed", "organization", id, { status, reason });
    } else if (action === "membership_role") {
      const id = String(body.id ?? ""), role = String(body.role ?? "");
      if (!id || !roles.includes(role as typeof roles[number])) return NextResponse.json({ error: "Invalid workspace role." }, { status: 400 });
      const { data: target, error: readError } = await admin.from("organization_memberships").select("organization_id,user_id,role").eq("id", id).maybeSingle();
      if (readError || !target) throw readError ?? new Error("Membership not found.");
      if (target.user_id === user.id && role !== "owner") return NextResponse.json({ error: "You cannot remove your own administrator access." }, { status: 400 });
      const { error } = await admin.from("organization_memberships").update({ role }).eq("id", id);
      if (error) throw error;
      await audit(admin, user.id, "workspace_role_changed", "organization_membership", id, { previous_role: target.role, role, target_user_id: target.user_id });
    } else if (action === "membership_remove") {
      const id = String(body.id ?? "");
      const { data: target, error: readError } = await admin.from("organization_memberships").select("organization_id,user_id,role").eq("id", id).maybeSingle();
      if (readError || !target) throw readError ?? new Error("Membership not found.");
      if (target.user_id === user.id) return NextResponse.json({ error: "You cannot remove your own membership." }, { status: 400 });
      if (!String(body.reason ?? "").trim()) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
      const { error } = await admin.from("organization_memberships").delete().eq("id", id);
      if (error) throw error;
      await audit(admin, user.id, "workspace_member_removed", "organization_membership", id, { target_user_id: target.user_id, role: target.role, reason: body.reason });
    } else if (action === "user_access") {
      const id = String(body.id ?? ""), suspend = Boolean(body.suspend);
      if (!id || id === user.id) return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 });
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: suspend ? "876000h" : "none" });
      if (error) throw error;
      await audit(admin, user.id, suspend ? "user_access_suspended" : "user_access_reactivated", "auth_user", id, { reason: String(body.reason ?? "") });
    } else if (action === "subscription_update") {
      const id = String(body.id ?? ""), status = String(body.status ?? ""), plan_code = String(body.plan_code ?? "trial").trim();
      if (!id || !subscriptionStatuses.includes(status as typeof subscriptionStatuses[number]) || !/^[a-z0-9_-]{2,40}$/i.test(plan_code)) return NextResponse.json({ error: "Invalid plan or subscription status." }, { status: 400 });
      const { error } = await admin.from("subscription_accounts").update({ status, plan_code, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await audit(admin, user.id, "subscription_updated", "subscription_account", id, { status, plan_code });
    } else if (action === "application_review") {
      const id = String(body.id ?? ""), decision = String(body.decision ?? ""), note = String(body.note ?? "").trim();
      if (!id || !["approve", "reject"].includes(decision)) return NextResponse.json({ error: "Invalid application decision." }, { status: 400 });
      if (decision === "reject" && note.length < 5) return NextResponse.json({ error: "A reason is required when rejecting an application." }, { status: 400 });
      const { data, error } = await admin.rpc("review_workspace_application", { p_application_id: id, p_decision: decision, p_review_note: note || null });
      if (error) throw error;
      await audit(admin, user.id, "workspace_application_" + decision, "workspace_application", id, { note });
    } else if (action === "support_update") {
      const id = String(body.id ?? ""), status = String(body.status ?? ""), priority = String(body.priority ?? "normal"), assigned_to = body.assigned_to || null, internal_notes = String(body.internal_notes ?? "");
      if (!id || !supportStatuses.includes(status as typeof supportStatuses[number]) || !["low", "normal", "high", "urgent"].includes(priority)) return NextResponse.json({ error: "Invalid support update." }, { status: 400 });
      const { error } = await admin.from("support_requests").update({ status, priority, assigned_to, internal_notes, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await audit(admin, user.id, "support_request_updated", "support_request", id, { status, priority, assigned_to });
    } else if (action === "setting_update") {
      const key = String(body.key ?? "").trim(), value = body.value;
      if (!/^[a-z][a-z0-9_.-]{1,100}$/.test(key) || value === undefined) return NextResponse.json({ error: "Invalid setting key or value." }, { status: 400 });
      const { error } = await admin.from("platform_settings").upsert({ key, value, description: String(body.description ?? ""), updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      await audit(admin, user.id, "platform_setting_updated", "platform_setting", key);
    } else {
      return NextResponse.json({ error: "Unsupported administrator action." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Administrator action failed." }, { status: 500 });
  }
}
