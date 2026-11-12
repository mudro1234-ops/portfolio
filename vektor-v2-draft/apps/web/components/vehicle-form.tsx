"use client";
import { ActionForm, Field, Input, Select, SubmitButton, type FormAction } from "@/components/action-form";
import { Card, LinkButton } from "@/components/ui";
import { FUEL_TYPES, VEHICLE_CATEGORIES, VEHICLE_STATUSES } from "@/lib/constants";

export interface VehicleDefaults {
  id?: string; registration_number?: string; category?: string; make?: string | null; model?: string | null;
  year?: number | null; colour?: string | null; vin?: string | null; fuel_type?: string; status?: string;
  odometer_km?: number | null; speed_limit_kmh?: number | null; insurance_expiry?: string | null; licence_expiry?: string | null;
}

export function VehicleForm({ action, defaults = {}, devices, drivers, cancelHref }: {
  action: FormAction;
  defaults?: VehicleDefaults;
  /** Only passed when creating: lets the user link a tracker and driver in the same step. */
  devices?: { value: string; label: string }[];
  drivers?: { value: string; label: string }[];
  cancelHref: string;
}) {
  const editing = !!defaults.id;
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-6">
      {editing && <input type="hidden" name="id" value={defaults.id} />}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Vehicle information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Registration number *" name="registration_number"><Input name="registration_number" defaultValue={defaults.registration_number} required maxLength={20} placeholder="e.g. AFA 1234" /></Field>
          <Field label="Vehicle type" name="category"><Select name="category" required defaultValue={defaults.category ?? "light_vehicle"} options={VEHICLE_CATEGORIES} /></Field>
          <Field label="Make" name="make"><Input name="make" defaultValue={defaults.make ?? ""} placeholder="Toyota" /></Field>
          <Field label="Model" name="model"><Input name="model" defaultValue={defaults.model ?? ""} placeholder="Hilux" /></Field>
          <Field label="Year" name="year"><Input name="year" type="number" inputMode="numeric" defaultValue={defaults.year ?? ""} min={1950} max={new Date().getFullYear() + 1} /></Field>
          <Field label="Colour" name="colour"><Input name="colour" defaultValue={defaults.colour ?? ""} /></Field>
          <Field label="VIN / chassis number" name="vin"><Input name="vin" defaultValue={defaults.vin ?? ""} /></Field>
          <Field label="Fuel type" name="fuel_type"><Select name="fuel_type" required defaultValue={defaults.fuel_type ?? "diesel"} options={FUEL_TYPES} /></Field>
          {editing && <Field label="Status" name="status"><Select name="status" required defaultValue={defaults.status ?? "active"} options={VEHICLE_STATUSES} /></Field>}
          <Field label="Odometer (km)" name="odometer_km"><Input name="odometer_km" type="number" step="0.1" min={0} defaultValue={defaults.odometer_km ?? ""} /></Field>
          <Field label="Speed limit (km/h)" name="speed_limit_kmh" help="Optional. Raises an overspeed alert when exceeded."><Input name="speed_limit_kmh" type="number" min={1} defaultValue={defaults.speed_limit_kmh ?? ""} /></Field>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Documents</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Insurance expiry" name="insurance_expiry"><Input name="insurance_expiry" type="date" defaultValue={defaults.insurance_expiry ?? ""} /></Field>
          <Field label="Licence expiry" name="licence_expiry"><Input name="licence_expiry" type="date" defaultValue={defaults.licence_expiry ?? ""} /></Field>
        </div>
      </Card>
      {!editing && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Tracking information</h2>
          <p className="mt-1 text-xs text-muted">Optional - you can link a tracker and driver later from the vehicle page.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="GPS device" name="device_id" help={devices && devices.length === 0 ? "No unlinked devices. Register one under GPS Devices first." : undefined}>
              <Select name="device_id" options={devices ?? []} placeholder="No device yet" />
            </Field>
            <Field label="Assigned driver" name="driver_id" help={drivers && drivers.length === 0 ? "No unassigned drivers available." : undefined}>
              <Select name="driver_id" options={drivers ?? []} placeholder="No driver yet" />
            </Field>
          </div>
        </Card>
      )}
      <div className="flex gap-3">
        <SubmitButton>{editing ? "Save changes" : "Add vehicle"}</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">Cancel</LinkButton>
      </div>
    </ActionForm>
  );
}
