import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const validCode = /^[A-Z]{2}$/;
const validCurrency = /^[A-Z]{3}$/;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char] as string));

export async function POST(request: Request) {
  let invitedUserId: string | null = null;
  let organizationId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

    const { data: adminMembership, error: adminCheckError } = await supabase.from("system_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminCheckError) return NextResponse.json({ error: "Could not verify platform administrator access." }, { status: 503 });
    if (!adminMembership) return NextResponse.json({ error: "Only a system administrator can create workspaces." }, { status: 403 });

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const workspaceName = typeof body.workspaceName === "string" ? body.workspaceName.trim() : "";
    const workspaceType = body.workspaceType === "individual" ? "individual" : body.workspaceType === "company" ? "company" : null;
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "ZW";
    const currencyCode = typeof body.currencyCode === "string" ? body.currencyCode.trim().toUpperCase() : "USD";
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!workspaceType || workspaceName.length < 2 || workspaceName.length > 120) return NextResponse.json({ error: "Choose a workspace type and enter a name between 2 and 120 characters." }, { status: 400 });
    if (!validCode.test(countryCode) || !validCurrency.test(currencyCode)) return NextResponse.json({ error: "Use a valid two-letter country code and three-letter currency code." }, { status: 400 });
    if (phone && phone.length > 40) return NextResponse.json({ error: "Phone number is too long." }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    if (!url || !secret) return NextResponse.json({ error: "Server-side Supabase admin credentials are not configured." }, { status: 503 });
    if (!resendKey || !fromEmail) return NextResponse.json({ error: "Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to Vercel server-side environment variables before creating accounts." }, { status: 503 });
    if (!appUrl) return NextResponse.json({ error: "Set NEXT_PUBLIC_APP_URL to your VEKTOR production domain before sending account invitations." }, { status: 503 });

    const admin = createAdminClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    if (existingUsers.users.some(candidate => candidate.email?.toLowerCase() === email)) {
      return NextResponse.json({ error: "An account with this email already exists. Use the user-management invitation flow instead." }, { status: 409 });
    }

    const slugBase = workspaceName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "workspace";
    const slug = `${slugBase}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
    const workspaceUrl = new URL(`/workspace/${slug}`, appUrl).toString();
    const temporaryPassword = randomBytes(18).toString("base64url");

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: workspaceName, workspace_name: workspaceName, workspace_type: workspaceType },
    });
    if (createError) throw createError;
    if (!created.user) throw new Error("Supabase did not return the created user.");
    invitedUserId = created.user.id;

    const { error: metadataError } = await admin.auth.admin.updateUserById(invitedUserId, {
      app_metadata: { ...(created.user.app_metadata ?? {}), must_change_password: true, workspace_slug: slug, workspace_type: workspaceType },
    });
    if (metadataError) throw metadataError;

    const { data: organization, error: organizationError } = await admin.from("organizations").insert({
      name: workspaceName, slug, created_by: invitedUserId, workspace_type: workspaceType,
      contact_email: email, contact_phone: phone || null, country_code: countryCode, currency_code: currencyCode,
    }).select("id,name,slug,workspace_type").single();
    if (organizationError || !organization) throw new Error(organizationError?.message || "Workspace could not be created.");
    organizationId = organization.id;

    const { error: membershipError } = await admin.from("organization_memberships").insert({ organization_id: organization.id, user_id: invitedUserId, role: "owner" });
    if (membershipError) throw membershipError;
    const { error: subscriptionError } = await admin.from("subscription_accounts").insert({ organization_id: organization.id });
    if (subscriptionError) throw subscriptionError;

    const safeName = escapeHtml(workspaceName);
    const safeEmail = escapeHtml(email);
    const safeUrl = escapeHtml(workspaceUrl);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Your VEKTOR ${workspaceType === "company" ? "company" : "individual"} workspace is ready`,
        text: `Hello ${workspaceName},\n\nYour VEKTOR account has been created.\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nSign in here: ${workspaceUrl}\n\nYou will be required to change this temporary password on your first sign-in. Do not share these credentials.\n\nVEKTOR Platform Team`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h2>Your VEKTOR workspace is ready</h2><p>Hello ${safeName},</p><p>Your ${workspaceType} workspace has been created by the VEKTOR platform administrator.</p><p><strong>Sign-in email:</strong> ${safeEmail}<br/><strong>Temporary password:</strong> <code>${temporaryPassword}</code></p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#6552a2;color:#fff;text-decoration:none;border-radius:8px">Open ${safeName} workspace</a></p><p>For security, you must change this temporary password immediately after signing in. Do not share these credentials.</p><p>VEKTOR Platform Team</p></div>`,
      }),
    });
    if (!emailResponse.ok) {
      const detail = await emailResponse.text();
      throw new Error(`Email provider rejected the invitation: ${detail.slice(0, 300)}`);
    }

    await admin.from("audit_logs").insert({
      organization_id: organization.id, actor_user_id: user.id, action: "workspace_created_by_system_admin",
      resource_type: "organization", resource_id: organization.id,
      metadata: { workspace_type: workspaceType, invited_email: email, workspace_slug: slug, email_delivery: "resend" },
    });

    return NextResponse.json({ created: true, invitationSent: true, workspace: organization, email, workspaceUrl }, { status: 201 });
  } catch (error) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && secret && (invitedUserId || organizationId)) {
      const admin = createAdminClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
      if (organizationId) {
        await admin.from("organization_memberships").delete().eq("organization_id", organizationId);
        await admin.from("subscription_accounts").delete().eq("organization_id", organizationId);
        await admin.from("organizations").delete().eq("id", organizationId);
      }
      if (invitedUserId) await admin.auth.admin.deleteUser(invitedUserId);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "The workspace invitation could not be completed." }, { status: 500 });
  }
}
