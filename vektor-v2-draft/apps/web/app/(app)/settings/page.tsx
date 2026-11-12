import type { Metadata } from "next";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { OrganizationForm, ProfileForm, ThresholdForm } from "@/components/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireCapability("settings");
  const supabase = await createClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", ctx.org.id).single(),
    supabase.from("user_profiles").select("full_name,phone").eq("id", ctx.userId).maybeSingle(),
  ]);
  if (!org) return <Notice tone="red">Organisation settings could not be loaded.</Notice>;
  const canEditOrg = ctx.role === "owner" || ctx.role === "admin";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://your-vektor-domain").replace(/\/$/, "");
  const secretConfigured = !!process.env.TRACCAR_WEBHOOK_SECRET;

  return (
    <>
      <PageHeader title="Settings" description="Organisation, regional, tracking and account settings." />
      <div className="max-w-4xl space-y-6">
        <OrganizationForm org={org} canEdit={canEditOrg} />
        <ThresholdForm org={org} canEdit={canEditOrg} />
        {can(ctx.role, "devices.manage") && (
          <Card><CardHeader title="GPS integration (Traccar)" description="How hardware trackers reach VEKTOR" />
            <div className="space-y-3 p-5 text-sm">
              {!secretConfigured && <Notice tone="amber" title="Webhook secret not configured">Set TRACCAR_WEBHOOK_SECRET on the server. Until then the ingestion endpoint rejects all requests.</Notice>}
              <p className="text-muted">In Traccar, enable event/position forwarding (<code>forward.enable=true</code>, <code>forward.json=true</code>) and set:</p>
              <dl className="grid gap-2 rounded-lg bg-slate-50 p-4 font-mono text-xs">
                <div><dt className="text-muted">forward.url</dt><dd className="break-all text-ink">{appUrl}/api/ingest/traccar</dd></div>
                <div><dt className="text-muted">forward.header (Authorization)</dt><dd className="text-ink">Bearer &lt;your TRACCAR_WEBHOOK_SECRET&gt;</dd></div>
              </dl>
              <p className="text-xs text-muted">Each tracker must be registered under GPS Devices with the same IMEI Traccar reports. Positions from unregistered or unlinked devices are not stored.</p>
            </div>
          </Card>
        )}
        <Card><CardHeader title="Data & privacy" /><div className="space-y-2 p-5 text-sm text-muted">
          <p>GPS history is kept for {org.position_retention_days} days, then deleted by the nightly cleanup. Smartphone tracking only runs for drivers who have given consent and can be stopped by the driver at any time.</p>
          <p>Important changes to vehicles, drivers, devices, geofences, team access and billing are recorded in the audit log.</p>
        </div></Card>
        <ProfileForm fullName={profile?.full_name ?? ctx.fullName} phone={profile?.phone ?? null} email={ctx.email} />
      </div>
    </>
  );
}
