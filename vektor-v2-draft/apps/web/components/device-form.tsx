"use client";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea, type FormAction } from "@/components/action-form";
import { Card, LinkButton } from "@/components/ui";

export interface DeviceDefaults {
  id?: string; imei?: string; manufacturer?: string | null; model?: string | null; protocol?: string | null;
  provider_device_id?: string | null; sim_operator?: string | null; sim_msisdn?: string | null; sim_iccid?: string | null;
  firmware_version?: string | null; installed_at?: string | null; installation_notes?: string | null;
  expected_interval_seconds?: number; vehicle_id?: string | null; status?: string;
}

export function DeviceForm({ action, defaults = {}, vehicles, cancelHref }: {
  action: FormAction; defaults?: DeviceDefaults; vehicles: { value: string; label: string }[]; cancelHref: string;
}) {
  const editing = !!defaults.id;
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-6">
      {editing && <input type="hidden" name="id" value={defaults.id} />}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Device</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="IMEI / unique identifier *" name="imei" help="Printed on the tracker label; must match what Traccar reports."><Input name="imei" defaultValue={defaults.imei} required /></Field>
          <Field label="Linked vehicle" name="vehicle_id"><Select name="vehicle_id" defaultValue={defaults.vehicle_id} options={vehicles} placeholder="Not linked yet" /></Field>
          <Field label="Manufacturer" name="manufacturer"><Input name="manufacturer" defaultValue={defaults.manufacturer ?? ""} placeholder="Teltonika" /></Field>
          <Field label="Model" name="model"><Input name="model" defaultValue={defaults.model ?? ""} placeholder="FMC920" /></Field>
          <Field label="Protocol" name="protocol"><Input name="protocol" defaultValue={defaults.protocol ?? ""} placeholder="teltonika" /></Field>
          <Field label="Traccar device ID" name="provider_device_id" help="Optional alternative identifier used by the gateway."><Input name="provider_device_id" defaultValue={defaults.provider_device_id ?? ""} /></Field>
          <Field label="Firmware version" name="firmware_version"><Input name="firmware_version" defaultValue={defaults.firmware_version ?? ""} /></Field>
          <Field label="Expected reporting interval (seconds)" name="expected_interval_seconds"><Input name="expected_interval_seconds" type="number" min={1} max={86400} defaultValue={defaults.expected_interval_seconds ?? 60} /></Field>
          {editing && <Field label="Status" name="status"><Select name="status" required defaultValue={defaults.status ?? "active"} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></Field>}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">SIM card</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Operator" name="sim_operator"><Input name="sim_operator" defaultValue={defaults.sim_operator ?? ""} placeholder="Econet / NetOne" /></Field>
          <Field label="Phone number (MSISDN)" name="sim_msisdn"><Input name="sim_msisdn" defaultValue={defaults.sim_msisdn ?? ""} /></Field>
          <Field label="ICCID" name="sim_iccid"><Input name="sim_iccid" defaultValue={defaults.sim_iccid ?? ""} /></Field>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Installation</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Installation date" name="installed_at" className="max-w-xs"><Input name="installed_at" type="date" defaultValue={defaults.installed_at ?? ""} /></Field>
          <Field label="Installation notes" name="installation_notes"><Textarea name="installation_notes" defaultValue={defaults.installation_notes ?? ""} placeholder="Where it is fitted, wiring, installer..." /></Field>
        </div>
      </Card>
      <div className="flex gap-3">
        <SubmitButton>{editing ? "Save changes" : "Register device"}</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">{editing ? "Back" : "Cancel"}</LinkButton>
      </div>
    </ActionForm>
  );
}
