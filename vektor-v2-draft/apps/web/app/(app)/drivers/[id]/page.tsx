import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can, invitableRoles } from "@/lib/permissions";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { DriverForm } from "@/components/driver-form";
import { DriverStatusButton } from "@/components/driver-controls";
import { GENERIC_TONE } from "@/lib/status";
import { formatDate, formatDateTime, formatDuration, formatKm, titleCase } from "@/lib/format";
import { updateDriver } from "../actions";

export const metadata: Metadata = { title: "Driver" };

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCapability("drivers");
  const supabase = await createClient();
  const { data: driver } = await supabase.from("drivers").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!driver) notFound();
  const canManage = can(ctx.role, "drivers.manage");

  const [{ data: assignment }, { data: consent }, { data: trips }] = await Promise.all([
    supabase.from("vehicle_assignments").select("assigned_at,vehicle:vehicles(id,registration_number)").eq("driver_id", id).is("unassigned_at", null).maybeSingle(),
    supabase.from("driver_consent_status").select("*").eq("driver_id", id).maybeSingle(),
    supabase.from("trips").select("id,status,started_at,ended_at,distance_km,vehicle:vehicles(registration_number)").eq("driver_id", id).order("started_at", { ascending: false, nullsFirst: false }).limit(15),
  ]);
  const vehicle = (Array.isArray(assignment?.vehicle) ? assignment?.vehicle[0] : assignment?.vehicle) as { id: string; registration_number: string } | null | undefined;
  const tz = ctx.org.timezone;

  return (
    <>
      <PageHeader title={driver.full_name} description={`${titleCase(driver.status)} driver`} actions={canManage ? <DriverStatusButton id={id} status={driver.status} /> : undefined} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {canManage ? <DriverForm action={updateDriver} defaults={driver} cancelHref="/drivers" /> : (
            <Card><CardHeader title="Driver details" /><dl className="grid gap-4 p-5 sm:grid-cols-2 text-sm">
              <div><dt className="text-xs text-muted">Phone</dt><dd>{driver.phone ?? "-"}</dd></div>
              <div><dt className="text-xs text-muted">Email</dt><dd>{driver.email ?? "-"}</dd></div>
              <div><dt className="text-xs text-muted">Licence</dt><dd>{driver.licence_number ?? "-"}</dd></div>
              <div><dt className="text-xs text-muted">Licence expiry</dt><dd>{formatDate(driver.licence_expiry)}</dd></div>
            </dl></Card>
          )}
          <Card>
            <CardHeader title="Recent trips" />
            {(trips ?? []).length === 0 ? <EmptyState title="No trips recorded for this driver" /> : (
              <Table><thead><tr><Th>Started</Th><Th>Vehicle</Th><Th>Duration</Th><Th>Distance</Th><Th>Status</Th></tr></thead><tbody>
                {(trips ?? []).map((t) => { const v = (Array.isArray(t.vehicle) ? t.vehicle[0] : t.vehicle) as { registration_number: string } | null; return (
                  <tr key={t.id} className="hover:bg-slate-50"><Td><Link href={`/trips/${t.id}`} className="text-brand hover:underline">{formatDateTime(t.started_at, tz)}</Link></Td><Td>{v?.registration_number ?? "-"}</Td><Td>{formatDuration(t.started_at, t.ended_at)}</Td><Td>{formatKm(t.distance_km)}</Td><Td><Badge tone={GENERIC_TONE[t.status]}>{titleCase(t.status)}</Badge></Td></tr>); })}
              </tbody></Table>)}
          </Card>
        </div>
        <div className="space-y-6">
          <Card><CardHeader title="Assigned vehicle" /><div className="p-5 text-sm">
            {vehicle ? <><Link href={`/vehicles/${vehicle.id}`} className="font-medium text-brand hover:underline">{vehicle.registration_number}</Link><p className="mt-1 text-xs text-muted">Since {formatDateTime(assignment?.assigned_at, tz)}</p></> : <p className="text-muted">No vehicle assigned. Assign one from the vehicle&apos;s page.</p>}
          </div></Card>
          <Card><CardHeader title="Driver app & tracking" /><div className="space-y-3 p-5 text-sm">
            <p>Login: {driver.user_id ? <Badge tone="green">Linked</Badge> : <Badge tone="grey">Not linked</Badge>}</p>
            <p>Tracking consent: {consent?.consented ? <Badge tone="green">Granted</Badge> : <Badge tone="grey">Not granted</Badge>}</p>
            {consent?.granted_at && <p className="text-xs text-muted">{consent.consented ? "Granted" : "Last granted"} {formatDateTime(consent.granted_at, tz)}{consent.withdrawn_at ? ` - withdrawn ${formatDateTime(consent.withdrawn_at, tz)}` : ""}</p>}
            {!driver.user_id && invitableRoles(ctx.role).includes("driver") && (
              <LinkButton href={`/team?email=${encodeURIComponent(driver.email ?? "")}&role=driver`} variant="secondary" size="sm">Invite to the driver app</LinkButton>)}
          </div></Card>
        </div>
      </div>
    </>
  );
}
