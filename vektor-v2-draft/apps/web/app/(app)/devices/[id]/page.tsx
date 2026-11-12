import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { DeviceForm } from "@/components/device-form";
import { DeleteDeviceButton } from "@/components/device-controls";
import { deviceConnection } from "@/lib/device-status";
import { formatDateTime, relativeTime } from "@/lib/format";
import { updateDevice } from "../actions";

export const metadata: Metadata = { title: "GPS device" };

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCapability("devices");
  const supabase = await createClient();
  const { data: device } = await supabase.from("gps_devices").select("*").eq("id", id).eq("organization_id", ctx.org.id).maybeSingle();
  if (!device) notFound();
  const { data: vehicles } = await supabase.from("vehicles").select("id,registration_number").eq("organization_id", ctx.org.id).neq("status", "retired").order("registration_number");
  const c = deviceConnection(device.last_communication_at, device.expected_interval_seconds, device.status);
  const canManage = can(ctx.role, "devices.manage");
  const vehicleOptions = (vehicles ?? []).map((v) => ({ value: v.id, label: v.registration_number }));

  return (
    <>
      <PageHeader title={`Device ${device.imei}`} description={[device.manufacturer, device.model].filter(Boolean).join(" ") || "GPS tracker"} actions={<Badge tone={c.tone}>{c.label}</Badge>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {canManage ? <DeviceForm action={updateDevice} defaults={device} vehicles={vehicleOptions} cancelHref="/devices" /> : (
            <Card><CardHeader title="Device details" /><p className="p-5 text-sm text-muted">You have read-only access to devices.</p></Card>)}
        </div>
        <div className="space-y-6">
          <Card><CardHeader title="Connection" /><dl className="space-y-3 p-5 text-sm">
            <div><dt className="text-xs text-muted">Last communication</dt><dd className="text-ink">{device.last_communication_at ? `${formatDateTime(device.last_communication_at, ctx.org.timezone)} (${relativeTime(device.last_communication_at)})` : "Never - no data has arrived from this device yet"}</dd></div>
            <div><dt className="text-xs text-muted">Expected interval</dt><dd className="text-ink">Every {device.expected_interval_seconds} s</dd></div>
            {!device.last_communication_at && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Check the tracker&apos;s APN and server settings, the SIM balance and signal, and that Traccar&apos;s forwarding is configured (see Settings).</p>}
          </dl></Card>
          {can(ctx.role, "settings") && canManage && <Card><CardHeader title="Danger zone" /><div className="p-5"><DeleteDeviceButton id={id} /></div></Card>}
        </div>
      </div>
    </>
  );
}
