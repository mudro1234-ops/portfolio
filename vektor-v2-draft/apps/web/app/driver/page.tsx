import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { getAppContext } from "@/lib/context";
import { defaultLandingPath } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { Card, CardHeader, Notice } from "@/components/ui";
import { ConsentCard } from "@/components/driver-consent-card";
import { signOut } from "@/app/auth/actions";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Driver home" };
export const dynamic = "force-dynamic";

/** Web fallback for drivers. Tracking itself happens in the mobile app. */
export default async function DriverHome() {
  const ctx = await getAppContext();
  if (ctx.role !== "driver") redirect(defaultLandingPath(ctx.role));
  const supabase = await createClient();
  const { data: driver } = await supabase.from("drivers").select("id,full_name,phone").eq("organization_id", ctx.org.id).eq("user_id", ctx.userId).maybeSingle();
  const [{ data: assignment }, { data: consent }] = driver ? await Promise.all([
    supabase.from("vehicle_assignments").select("assigned_at,vehicle:vehicles(registration_number,make,model)").eq("driver_id", driver.id).is("unassigned_at", null).maybeSingle(),
    supabase.from("driver_consent_status").select("consented,granted_at").eq("driver_id", driver.id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const vehicle = (Array.isArray(assignment?.vehicle) ? assignment?.vehicle[0] : assignment?.vehicle) as { registration_number: string; make: string | null; model: string | null } | null | undefined;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-[68px] items-center justify-between bg-navy px-5"><Logo light /><form action={signOut}><button className="text-sm text-slate-300 hover:text-white">Sign out</button></form></header>
      <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
        <div><h1 className="text-2xl font-semibold text-ink">Hello, {driver?.full_name?.split(" ")[0] ?? ctx.fullName.split(" ")[0]}</h1><p className="text-sm text-muted">{ctx.org.name}</p></div>
        {!driver && <Notice tone="amber" title="Your driver profile is not linked yet">Ask your fleet manager to link your account to a driver record.</Notice>}
        <Card><CardHeader title="My vehicle" /><div className="p-5 text-sm">
          {vehicle ? <><p className="text-lg font-semibold text-ink">{vehicle.registration_number}</p><p className="text-muted">{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</p><p className="mt-1 text-xs text-muted">Assigned {formatDateTime(assignment?.assigned_at, ctx.org.timezone)}</p></> : <p className="text-muted">No vehicle is assigned to you right now.</p>}
        </div></Card>
        <Card><CardHeader title="Location tracking consent" /><div className="p-5"><ConsentCard consented={!!consent?.consented} /></div></Card>
        <Card><div className="flex gap-3 p-5 text-sm text-muted"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden /><p>Start and stop tracking in the VEKTOR driver app on your phone. Location is only shared while tracking is switched on, and you can stop at any time.</p></div></Card>
      </main>
    </div>
  );
}
