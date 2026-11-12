"use client";
import { ActionForm, Field, Input, Select, SubmitButton, type FormAction } from "@/components/action-form";
import { Card, LinkButton } from "@/components/ui";

export interface DriverDefaults {
  id?: string; full_name?: string; phone?: string | null; email?: string | null; licence_number?: string | null;
  licence_expiry?: string | null; emergency_contact?: string | null; status?: string;
}

export function DriverForm({ action, defaults = {}, cancelHref }: { action: FormAction; defaults?: DriverDefaults; cancelHref: string }) {
  const editing = !!defaults.id;
  return (
    <ActionForm action={action} resetOnSuccess={false} className="space-y-6">
      {editing && <input type="hidden" name="id" value={defaults.id} />}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Driver details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name *" name="full_name"><Input name="full_name" defaultValue={defaults.full_name} required /></Field>
          <Field label="Phone" name="phone"><Input name="phone" type="tel" defaultValue={defaults.phone ?? ""} placeholder="+263 ..." /></Field>
          <Field label="Email" name="email" help="Used to link the driver's app login when they accept an invitation."><Input name="email" type="email" defaultValue={defaults.email ?? ""} /></Field>
          <Field label="Emergency contact" name="emergency_contact"><Input name="emergency_contact" defaultValue={defaults.emergency_contact ?? ""} placeholder="Name and phone" /></Field>
          <Field label="Driving licence number" name="licence_number"><Input name="licence_number" defaultValue={defaults.licence_number ?? ""} /></Field>
          <Field label="Licence expiry" name="licence_expiry"><Input name="licence_expiry" type="date" defaultValue={defaults.licence_expiry ?? ""} /></Field>
          {editing && (
            <Field label="Status" name="status"><Select name="status" required defaultValue={defaults.status ?? "active"}
              options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "suspended", label: "Suspended" }]} /></Field>
          )}
        </div>
      </Card>
      <div className="flex gap-3">
        <SubmitButton>{editing ? "Save changes" : "Add driver"}</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">{editing ? "Back" : "Cancel"}</LinkButton>
      </div>
    </ActionForm>
  );
}
