"use client";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea, type FormAction } from "@/components/action-form";
import { Card, LinkButton } from "@/components/ui";
import { CURRENCIES, MAINTENANCE_TYPES } from "@/lib/constants";

export interface MaintenanceDefaults {
  id?: string; vehicle_id?: string; maintenance_type?: string; description?: string | null; service_date?: string;
  next_service_date?: string | null; next_service_odometer_km?: number | null; cost?: number | null; currency?: string;
  provider?: string | null; status?: string;
}

export function MaintenanceForm({ action, defaults = {}, vehicles, defaultCurrency }: {
  action: FormAction; defaults?: MaintenanceDefaults; vehicles: { value: string; label: string }[]; defaultCurrency: string;
}) {
  const editing = !!defaults.id;
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-6">
      {editing && <input type="hidden" name="id" value={defaults.id} />}
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vehicle *" name="vehicle_id"><Select name="vehicle_id" required defaultValue={defaults.vehicle_id} options={vehicles} placeholder="Choose a vehicle" /></Field>
          <Field label="Maintenance type *" name="maintenance_type">
            <Input name="maintenance_type" list="maintenance-types" required defaultValue={defaults.maintenance_type} placeholder="Routine service" />
            <datalist id="maintenance-types">{MAINTENANCE_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Service date *" name="service_date"><Input name="service_date" type="date" required defaultValue={defaults.service_date} /></Field>
          <Field label="Status" name="status"><Select name="status" required defaultValue={defaults.status ?? "scheduled"} options={[{ value: "scheduled", label: "Scheduled" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} /></Field>
          <Field label="Service provider / workshop" name="provider"><Input name="provider" defaultValue={defaults.provider ?? ""} /></Field>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <Field label="Cost" name="cost"><Input name="cost" type="number" step="0.01" min={0} defaultValue={defaults.cost ?? ""} /></Field>
            <Field label="Currency" name="currency"><Select name="currency" required defaultValue={defaults.currency ?? defaultCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></Field>
          </div>
          <Field label="Next service date" name="next_service_date"><Input name="next_service_date" type="date" defaultValue={defaults.next_service_date ?? ""} /></Field>
          <Field label="Next service at odometer (km)" name="next_service_odometer_km"><Input name="next_service_odometer_km" type="number" min={0} defaultValue={defaults.next_service_odometer_km ?? ""} /></Field>
        </div>
        <Field label="Description" name="description" className="mt-4"><Textarea name="description" defaultValue={defaults.description ?? ""} placeholder="Work carried out, parts, findings" /></Field>
      </Card>
      <div className="flex gap-3"><SubmitButton>{editing ? "Save changes" : "Save record"}</SubmitButton><LinkButton href="/maintenance" variant="secondary">Cancel</LinkButton></div>
    </ActionForm>
  );
}
