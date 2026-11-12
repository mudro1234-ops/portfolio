import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Capability, type Role } from "@/lib/permissions";

export interface OrgInfo {
  id: string;
  name: string;
  status: string;
  currency: string;
  timezone: string;
  country: string;
  stale_after_seconds: number;
  offline_after_seconds: number;
}

export interface AppContext {
  userId: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  org: OrgInfo;
  role: Role;
  orgs: { id: string; name: string; role: Role }[];
  unreadNotifications: number;
}

export const ORG_COOKIE = "vektor_org";

/**
 * Loads the signed-in user, their organisations and the active workspace.
 * Redirects to /login, /onboarding or a status page when a workspace can't be opened.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("user_profiles").select("full_name,is_platform_admin").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("role,status,organization:organizations(id,name,status,currency,timezone,country,stale_after_seconds,offline_after_seconds)")
      .eq("user_id", user.id),
  ]);

  const rows = (memberships ?? []) as unknown as {
    role: Role; status: string; organization: OrgInfo | OrgInfo[] | null;
  }[];
  const usable = rows
    .map((m) => ({ role: m.role, status: m.status, org: Array.isArray(m.organization) ? m.organization[0] : m.organization }))
    .filter((m) => m.status === "active" && m.org);

  if (usable.length === 0) {
    if (profile?.is_platform_admin) redirect("/platform");
    if (rows.length > 0) redirect("/access-denied?reason=suspended");
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ORG_COOKIE)?.value;
  const active = usable.find((m) => m.org!.id === wanted) ?? usable[0];

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email ?? "User",
    isPlatformAdmin: !!profile?.is_platform_admin,
    org: active.org!,
    role: active.role,
    orgs: usable.map((m) => ({ id: m.org!.id, name: m.org!.name, role: m.role })),
    unreadNotifications: count ?? 0,
  };
});

/** Page-level guard. Hiding a link is not security; this plus RLS is. */
export async function requireCapability(capability: Capability): Promise<AppContext> {
  const ctx = await getAppContext();
  if (ctx.role === "driver") redirect("/driver");
  if (!can(ctx.role, capability)) redirect("/access-denied");
  return ctx;
}
