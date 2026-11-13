import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const validCode = /^[A-Z]{2}$/;
const validCurrency = /^[A-Z]{3}$/;

export async function POST(request: Request) {
  let invitedUserId: string | null = null;
  let organizationId: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    }

    const { data: adminMembership, error: adminCheckError } = await supabase
      .from("system_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminCheckError) {
      return NextResponse.json({ error: "Could not verify platform administrator access." }, { status: 503 });
    }
    if (!adminMembership) {
      return NextResponse.json({ error: "Only a system administrator can create workspaces." }, { status: 403 });
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const workspaceName = typeof body.workspaceName === "string" ? body.workspaceName.trim() : "";
    const workspaceType = body.workspaceType === "individual" ? "individual" : body.workspaceType === "company" ? "company" : null;
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "ZW";
    const currencyCode = typeof body.currencyCode === "string" ? body.currencyCode.trim().toUpperCase() : "USD";
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!workspaceType || workspaceName.length < 2 || workspaceName.length > 120) {
      return NextResponse.json({ error: "Choose a workspace type and enter a name between 2 and 120 characters." }, { status: 400 });
    }
    if (!validCode.test(countryCode) || !validCurrency.test(currencyCode)) {
      return NextResponse.json({ error: "Use a valid two-letter country code and three-letter currency code." }, { status: 400 });
    }
    if (phone && phone.length > 40) {
      return NextResponse.json({ error: "Phone number is too long." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secret) {
      return NextResponse.json({
        error: "The secure invitation service is not configured. Add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to Vercel server-side environment variables.",
      }, { status: 503 });
    }

    const admin = createAdminClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const redirectTo = appUrl ? new URL("/auth/callback?next=%2Fset-password", appUrl).toString() : undefined;

    const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (invitationError) {
      return NextResponse.json({ error: invitationError.message }, { status: 409 });
    }
    if (!invitation.user) {
      return NextResponse.json({ error: "Supabase did not return the invited user." }, { status: 502 });
    }
    invitedUserId = invitation.user.id;

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({
        name: workspaceName,
        slug: `${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "workspace"}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
        created_by: invitedUserId,
        workspace_type: workspaceType,
        contact_email: email,
        contact_phone: phone || null,
        country_code: countryCode,
        currency_code: currencyCode,
      })
      .select("id, name, workspace_type")
      .single();

    if (organizationError || !organization) {
      throw new Error(organizationError?.message || "Workspace could not be created.");
    }
    organizationId = organization.id;

    const { error: membershipError } = await admin
      .from("organization_memberships")
      .insert({ organization_id: organization.id, user_id: invitedUserId, role: "owner" });
    if (membershipError) throw membershipError;

    const { error: subscriptionError } = await admin
      .from("subscription_accounts")
      .insert({ organization_id: organization.id });
    if (subscriptionError) throw subscriptionError;

    await admin.from("audit_logs").insert({
      organization_id: organization.id,
      actor_user_id: user.id,
      action: "workspace_created_by_system_admin",
      resource_type: "organization",
      resource_id: organization.id,
      metadata: { workspace_type: workspaceType, invited_email: email },
    });

    return NextResponse.json({
      created: true,
      invitationSent: true,
      workspace: organization,
      email,
    }, { status: 201 });
  } catch (error) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && secret && (invitedUserId || organizationId)) {
      const admin = createAdminClient(url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (organizationId) {
        await admin.from("organization_memberships").delete().eq("organization_id", organizationId);
        await admin.from("subscription_accounts").delete().eq("organization_id", organizationId);
        await admin.from("organizations").delete().eq("id", organizationId);
      }
      if (invitedUserId) await admin.auth.admin.deleteUser(invitedUserId);
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The workspace invitation could not be completed.",
    }, { status: 500 });
  }
}
